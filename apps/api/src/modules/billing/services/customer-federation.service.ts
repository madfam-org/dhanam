import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '@core/prisma/prisma.service';

/**
 * =============================================================================
 * Customer Federation Service
 * =============================================================================
 * Assembles customer billing data for the PhyndCRM federation layer.
 *
 * PhyndCRM federates data from MADFAM ecosystem services via its
 * DhanamProvider, which expects a DhanamRawCustomer shape containing:
 * - Subscription status (plan + status)
 * - Account balance (amount + currency)
 * - Recent invoices (last 20 billing events with payment status)
 * - Payment methods (provider info derived from user billing config)
 *
 * The externalId parameter maps to the Dhanam user's `id` field,
 * which PhyndCRM stores as an external reference.
 * =============================================================================
 */

/** Matches PhyndCRM's DhanamRawCustomer interface */
export interface FederatedCustomerResponse {
  id: string;
  subscription: {
    plan: string;
    status: string;
  };
  balance: {
    amount: number;
    currency: string;
  };
  invoices: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    paid_at: string | null;
  }>;
  payment_methods: Array<{
    id: string;
    type: string;
    last_four: string;
    is_default: boolean;
  }>;
}

@Injectable()
export class CustomerFederationService {
  private readonly logger = new Logger(CustomerFederationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch customer billing data by external ID for federation.
   *
   * Assembles subscription status, balance, recent invoices, and payment
   * method info from the user's billing records.
   */
  async getCustomerByExternalId(externalId: string): Promise<FederatedCustomerResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: externalId },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionStartedAt: true,
        subscriptionExpiresAt: true,
        trialTier: true,
        trialEndsAt: true,
        billingProvider: true,
        countryCode: true,
        stripeCustomerId: true,
        paddleCustomerId: true,
        januaCustomerId: true,
        billingEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
            metadata: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`Federation lookup failed: user not found for externalId=${externalId}`);
      throw new NotFoundException(`Customer not found: ${externalId}`);
    }

    return {
      id: user.id,
      subscription: this.buildSubscription(user),
      balance: this.buildBalance(user),
      invoices: this.buildInvoices(user.billingEvents),
      payment_methods: this.buildPaymentMethods(user),
    };
  }

  private buildSubscription(user: {
    subscriptionTier: string;
    subscriptionExpiresAt: Date | null;
    trialTier: string | null;
    trialEndsAt: Date | null;
  }): FederatedCustomerResponse['subscription'] {
    const now = new Date();

    // Check if user is in an active trial
    if (user.trialTier && user.trialEndsAt && new Date(user.trialEndsAt) > now) {
      return {
        plan: user.trialTier,
        status: 'trialing',
      };
    }

    // Check if subscription has expired
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) <= now) {
      return {
        plan: user.subscriptionTier,
        status: 'expired',
      };
    }

    // Active subscription or community (free) tier
    return {
      plan: user.subscriptionTier,
      status: user.subscriptionTier === 'community' ? 'free' : 'active',
    };
  }

  private buildBalance(user: {
    billingEvents: Array<{
      amount: unknown;
      currency: string;
      status: string;
    }>;
    countryCode: string | null;
  }): FederatedCustomerResponse['balance'] {
    // Calculate outstanding balance from unpaid billing events
    const pendingEvents = user.billingEvents.filter(
      (event) => event.status === 'pending' || event.status === 'failed'
    );

    const outstandingAmount = pendingEvents.reduce((sum, event) => sum + Number(event.amount), 0);

    // Determine currency from billing events or country
    const currency = pendingEvents[0]?.currency ?? (user.countryCode === 'MX' ? 'MXN' : 'USD');

    return {
      amount: outstandingAmount,
      currency,
    };
  }

  private buildInvoices(
    billingEvents: Array<{
      id: string;
      type: string;
      amount: unknown;
      currency: string;
      status: string;
      createdAt: Date;
      metadata: unknown;
    }>
  ): FederatedCustomerResponse['invoices'] {
    // Filter to payment-related events (subscriptions created/renewed and payments)
    const invoiceEvents = billingEvents.filter((event) =>
      [
        'subscription_created',
        'subscription_renewed',
        'payment_succeeded',
        'payment_failed',
        'payment_refunded',
      ].includes(event.type)
    );

    return invoiceEvents.map((event) => {
      const metadata = event.metadata as Record<string, unknown> | null;

      return {
        id: event.id,
        amount: Number(event.amount),
        currency: event.currency,
        status: this.mapBillingStatusToInvoiceStatus(event.status),
        created_at: event.createdAt.toISOString(),
        paid_at:
          event.status === 'succeeded'
            ? ((metadata?.paidAt as string) ?? event.createdAt.toISOString())
            : null,
      };
    });
  }

  private buildPaymentMethods(user: {
    billingProvider: string | null;
    stripeCustomerId: string | null;
    paddleCustomerId: string | null;
    januaCustomerId: string | null;
  }): FederatedCustomerResponse['payment_methods'] {
    // Dhanam does not store raw card details (PCI compliance).
    // We expose the billing provider configuration as a payment method
    // reference so PhyndCRM can display which provider is active.
    const methods: FederatedCustomerResponse['payment_methods'] = [];

    if (user.stripeCustomerId) {
      methods.push({
        id: user.stripeCustomerId,
        type: 'stripe',
        last_four: '****',
        is_default: user.billingProvider === 'stripe' || user.billingProvider === 'stripe_mx',
      });
    }

    if (user.paddleCustomerId) {
      methods.push({
        id: user.paddleCustomerId,
        type: 'paddle',
        last_four: '****',
        is_default: user.billingProvider === 'paddle',
      });
    }

    if (user.januaCustomerId) {
      methods.push({
        id: user.januaCustomerId,
        type: user.billingProvider ?? 'janua',
        last_four: '****',
        is_default: !user.stripeCustomerId && !user.paddleCustomerId,
      });
    }

    return methods;
  }

  private mapBillingStatusToInvoiceStatus(status: string): string {
    switch (status) {
      case 'succeeded':
        return 'paid';
      case 'pending':
        return 'open';
      case 'failed':
        return 'failed';
      case 'refunded':
        return 'refunded';
      default:
        return status;
    }
  }
}
