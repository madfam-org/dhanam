/**
 * =============================================================================
 * Stripe Connect Service
 * =============================================================================
 * Marketplace primitives built on Stripe Connect:
 *   - Express merchant accounts (accounts.create + accountLinks)
 *   - Destination charges (charge customer, settle to merchant, take app fee)
 *   - Transfers (platform → merchant)
 *   - Payouts (merchant → bank)
 *   - Disputes (submit evidence)
 *   - Merchant balance retrieval
 *
 * This service implements the marketplace half of IPaymentProcessor. The
 * subscription-mode StripeService lives alongside it and handles the B2C
 * half. They share the same underlying Stripe SDK but deliberately do
 * NOT share instance state — Connect operates on different API calls and
 * fails louder when isolated.
 *
 * Credentials from dhanam-secrets K8s Secret:
 *   - STRIPE_SECRET_KEY           (same key as StripeService; Connect is
 *                                  a capability on the platform account)
 *   - STRIPE_CONNECT_CLIENT_ID    (only required if using OAuth Connect;
 *                                  Express accounts don't need it)
 *   - STRIPE_WEBHOOK_SECRET       (shared with StripeService)
 * =============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { ErrorCode, InfrastructureException } from '../../../core/exceptions/domain-exceptions';

import {
  ChargeHandle,
  CreateDestinationChargeInput,
  CreateMerchantInput,
  CreatePayoutInput,
  CreateTransferInput,
  DisputeEvidence,
  DisputeHandle,
  MerchantAccountHandle,
  MerchantBalance,
  OnboardingLink,
  PayoutHandle,
  ProcessorCapabilities,
  ProcessorId,
  TransferHandle,
} from './payment-processor.interface';

@Injectable()
export class StripeConnectService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeConnectService.name);

  readonly id: ProcessorId = 'stripe';
  readonly capabilities: ProcessorCapabilities = {
    subscriptions: true,
    oneOffCharges: true,
    marketplace: true,
    disputes: true,
    threeDSecure: true,
    taxCompliance: 'automatic',
  };

  constructor(private config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured — Connect disabled');
      return;
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-02-25.clover',
      typescript: true,
      appInfo: { name: 'Dhanam Connect', version: '0.3.0' },
    });
    this.logger.log('Stripe Connect service initialized');
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new InfrastructureException(
        ErrorCode.CONFIGURATION_ERROR,
        'Stripe Connect is not configured. Set STRIPE_SECRET_KEY.'
      );
    }
    return this.stripe;
  }

  // ---------------------------------------------------------------------------
  // Merchant accounts
  // ---------------------------------------------------------------------------

  async createMerchantAccount(input: CreateMerchantInput): Promise<MerchantAccountHandle> {
    const stripe = this.requireStripe();
    this.logger.log(
      `Creating Express Connect account for user=${input.userId} country=${input.country}`
    );

    const account = await stripe.accounts.create({
      type: 'express',
      country: input.country,
      email: input.email,
      default_currency: input.defaultCurrency.toLowerCase(),
      business_type: input.businessType ?? 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        dhanam_user_id: input.userId,
        ...(input.metadata ?? {}),
      },
    });

    return this.toMerchantHandle(account);
  }

  async createMerchantOnboardingLink(
    externalId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<OnboardingLink> {
    const stripe = this.requireStripe();
    const link = await stripe.accountLinks.create({
      account: externalId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    });
    return {
      url: link.url,
      expiresAt: new Date(link.expires_at * 1000),
    };
  }

  async getMerchantAccount(externalId: string): Promise<MerchantAccountHandle> {
    const stripe = this.requireStripe();
    const account = await stripe.accounts.retrieve(externalId);
    return this.toMerchantHandle(account);
  }

  // ---------------------------------------------------------------------------
  // Destination charges (platform collects, settles to merchant, keeps fee)
  // ---------------------------------------------------------------------------

  async createDestinationCharge(input: CreateDestinationChargeInput): Promise<ChargeHandle> {
    const stripe = this.requireStripe();

    const pi = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      description: input.description,
      customer: input.customerId,
      payment_method: input.paymentMethodId,
      capture_method: input.captureMethod ?? 'automatic',
      application_fee_amount: input.applicationFeeAmount,
      transfer_data: {
        destination: input.merchantExternalId,
      },
      on_behalf_of: input.merchantExternalId,
      automatic_payment_methods: { enabled: true },
      metadata: input.metadata ?? {},
    });

    return {
      externalId: pi.id,
      amount: pi.amount,
      currency: pi.currency.toUpperCase() as ChargeHandle['currency'],
      status: pi.status as ChargeHandle['status'],
      clientSecret: pi.client_secret ?? undefined,
      // application_fee + transfer land asynchronously; persist the IDs via webhook.
    };
  }

  // ---------------------------------------------------------------------------
  // Transfers (separate from destination charge)
  // ---------------------------------------------------------------------------

  async createTransfer(input: CreateTransferInput): Promise<TransferHandle> {
    const stripe = this.requireStripe();
    const transfer = await stripe.transfers.create({
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      destination: input.merchantExternalId,
      source_transaction: input.sourceChargeId,
      description: input.description,
      metadata: input.metadata ?? {},
    });
    return {
      externalId: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency.toUpperCase() as TransferHandle['currency'],
      status: 'pending', // Stripe transfers don't carry a status on create; webhook promotes it.
    };
  }

  // ---------------------------------------------------------------------------
  // Payouts (merchant → bank, initiated on their behalf)
  // ---------------------------------------------------------------------------

  async createPayout(input: CreatePayoutInput): Promise<PayoutHandle> {
    const stripe = this.requireStripe();
    const payout = await stripe.payouts.create(
      {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        method: input.method ?? 'standard',
        description: input.description,
        metadata: input.metadata ?? {},
      },
      { stripeAccount: input.merchantExternalId }
    );
    return {
      externalId: payout.id,
      amount: payout.amount,
      currency: payout.currency.toUpperCase() as PayoutHandle['currency'],
      status: payout.status as PayoutHandle['status'],
      arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Balance retrieval
  // ---------------------------------------------------------------------------

  async getMerchantBalance(externalId: string): Promise<MerchantBalance> {
    const stripe = this.requireStripe();
    const balance = await stripe.balance.retrieve({ stripeAccount: externalId });
    return {
      available: balance.available.map((b) => ({
        amount: b.amount,
        currency: b.currency.toUpperCase() as MerchantBalance['available'][number]['currency'],
      })),
      pending: balance.pending.map((b) => ({
        amount: b.amount,
        currency: b.currency.toUpperCase() as MerchantBalance['pending'][number]['currency'],
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Disputes
  // ---------------------------------------------------------------------------

  async submitDisputeEvidence(
    externalId: string,
    evidence: DisputeEvidence
  ): Promise<DisputeHandle> {
    const stripe = this.requireStripe();
    const updated = await stripe.disputes.update(externalId, {
      evidence: {
        product_description: evidence.productDescription,
        customer_communication: evidence.customerCommunication,
        receipt: evidence.receipt,
        shipping_documentation: evidence.shippingDocumentation,
        uncategorized_text: evidence.uncategorizedText,
      },
      submit: true,
    });
    return {
      externalId: updated.id,
      status: updated.status,
      amount: updated.amount,
      currency: updated.currency.toUpperCase() as DisputeHandle['currency'],
      reason: updated.reason,
      evidenceDueBy: updated.evidence_details?.due_by
        ? new Date(updated.evidence_details.due_by * 1000)
        : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toMerchantHandle(account: Stripe.Account): MerchantAccountHandle {
    return {
      externalId: account.id,
      chargesEnabled: account.charges_enabled ?? false,
      payoutsEnabled: account.payouts_enabled ?? false,
      detailsSubmitted: account.details_submitted ?? false,
      requirements: account.requirements
        ? {
            currentlyDue: account.requirements.currently_due ?? [],
            pastDue: account.requirements.past_due ?? [],
            disabledReason: account.requirements.disabled_reason ?? null,
          }
        : undefined,
    };
  }
}
