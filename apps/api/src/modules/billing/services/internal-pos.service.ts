import * as crypto from 'crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';

import { AuditService } from '@core/audit/audit.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { Prisma, Currency } from '@db';

import { StripeService } from '../stripe.service';

import { ConektaService } from './conekta.service';
import { StripeMxService } from './stripe-mx.service';

export type PosProvider = 'stripe_mx' | 'legacy_stripe' | 'conekta';

export interface PosChargeRequest {
  userId: string;
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethod?: 'card' | 'oxxo' | 'customer_balance' | 'spei';
  correlationId?: string;
  countryCode?: string;
  operatorId: string;
  provider?: PosProvider | 'auto';
}

export interface PosChargeResult {
  correlationId: string;
  provider: PosProvider;
  paymentIntentId: string;
  clientSecret: string | null;
  status: string;
  currency: string;
  amountMinor: number;
}

export interface PosRefundRequest {
  paymentIntentId: string;
  amountMinor?: number;
  reason?: string;
  correlationId?: string;
  operatorId: string;
}

export interface PosRefundResult {
  correlationId: string;
  refundId: string;
  provider: PosProvider;
  status: string | null;
  amountMinor: number;
  currency: string;
}

export interface PosProductWebhookDelivery {
  consumer: string;
  status: 'delivered' | 'failed' | 'pending' | 'resolved';
  cfdiUuid?: string | null;
  eventType?: string | null;
  lastError?: string | null;
}

export interface PosTimelineEntry {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: Date;
  metadata: unknown;
  cfdiUuid?: string | null;
  productWebhookDeliveries?: PosProductWebhookDelivery[];
}

export interface PosReconciliationSummary {
  flaggedCount: number;
  recentMismatches: Array<{
    id: string;
    userId: string | null;
    type: string;
    status: string;
    createdAt: Date;
    metadata: unknown;
  }>;
}

/**
 * Operator POS primitives: direct charge/refund, correlation timelines, and
 * reconciliation visibility for internal MADFAM sales workflows.
 */
@Injectable()
export class InternalPosService {
  private readonly logger = new Logger(InternalPosService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private stripeMx: StripeMxService,
    private stripe: StripeService,
    @Optional() private conekta?: ConektaService
  ) {}

  async createCharge(request: PosChargeRequest): Promise<PosChargeResult> {
    if (!Number.isInteger(request.amountMinor) || request.amountMinor <= 0) {
      throw new BadRequestException('amountMinor must be a positive integer');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: request.userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        countryCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const correlationId = request.correlationId || crypto.randomUUID();
    const countryCode = (request.countryCode || user.countryCode || 'US').toUpperCase();
    const currency = request.currency.toLowerCase();
    const providerChoice = request.provider ?? 'auto';
    const metadata = {
      dhanam_user_id: user.id,
      correlation_id: correlationId,
      source: 'internal_pos',
      operator_id: request.operatorId,
    };

    const useConekta =
      providerChoice === 'conekta' ||
      (providerChoice === 'auto' &&
        countryCode === 'MX' &&
        currency === 'mxn' &&
        !this.stripeMx.isConfigured() &&
        this.conekta?.isConfigured());

    if (useConekta && countryCode === 'MX' && currency === 'mxn' && this.conekta?.isConfigured()) {
      const paymentSource =
        request.paymentMethod === 'oxxo'
          ? { type: 'oxxo_cash' as const }
          : { type: 'spei' as const };

      const charge = await this.conekta.createCharge({
        amount: request.amountMinor,
        currency: 'MXN',
        customerInfo: {
          name: user.name || user.email,
          email: user.email,
        },
        paymentSource,
        description: request.description,
        metadata: {
          ...Object.fromEntries(
            Object.entries(metadata).map(([key, value]) => [key, String(value)])
          ),
          idempotency_key: correlationId,
        },
      });

      await this.recordPosEvent(user.id, 'payment_succeeded', request.amountMinor, Currency.MXN, {
        correlationId,
        paymentIntentId: charge.orderId,
        chargeId: charge.chargeId,
        provider: 'conekta',
        operatorId: request.operatorId,
      });

      await this.audit.log({
        userId: request.operatorId,
        action: 'ADMIN_POS_CHARGE_INITIATED',
        severity: 'high',
        metadata: {
          targetUserId: user.id,
          correlationId,
          paymentIntentId: charge.orderId,
          chargeId: charge.chargeId,
          provider: 'conekta',
          amountMinor: request.amountMinor,
          currency: 'MXN',
        },
      });

      return {
        correlationId,
        provider: 'conekta',
        paymentIntentId: charge.orderId,
        clientSecret: charge.paymentInstructions?.reference ?? null,
        status: charge.paymentStatus,
        currency: 'MXN',
        amountMinor: request.amountMinor,
      };
    }

    if (
      countryCode === 'MX' &&
      currency === 'mxn' &&
      this.stripeMx.isConfigured() &&
      providerChoice !== 'legacy_stripe'
    ) {
      const paymentIntent = await this.stripeMx.createPaymentIntent({
        amount: request.amountMinor,
        customerEmail: user.email,
        customerId: user.stripeCustomerId || undefined,
        description: request.description,
        paymentMethod:
          request.paymentMethod === 'spei' ? 'customer_balance' : request.paymentMethod || 'card',
        metadata,
      });

      await this.recordPosEvent(user.id, 'payment_succeeded', request.amountMinor, Currency.MXN, {
        correlationId,
        paymentIntentId: paymentIntent.id,
        provider: 'stripe_mx',
        operatorId: request.operatorId,
      });

      await this.audit.log({
        userId: request.operatorId,
        action: 'ADMIN_POS_CHARGE_INITIATED',
        severity: 'high',
        metadata: {
          targetUserId: user.id,
          correlationId,
          paymentIntentId: paymentIntent.id,
          provider: 'stripe_mx',
          amountMinor: request.amountMinor,
          currency: 'MXN',
        },
      });

      return {
        correlationId,
        provider: 'stripe_mx',
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        currency: 'MXN',
        amountMinor: request.amountMinor,
      };
    }

    if (currency !== 'usd') {
      throw new BadRequestException(
        'Legacy POS charge supports USD only; use MXN + MX country for Stripe MX'
      );
    }

    const paymentIntent = await this.stripe.createPaymentIntent({
      amount: request.amountMinor,
      currency: 'usd',
      customerEmail: user.email,
      customerId: user.stripeCustomerId || undefined,
      description: request.description,
      metadata,
    });

    await this.recordPosEvent(user.id, 'payment_succeeded', request.amountMinor, Currency.USD, {
      correlationId,
      paymentIntentId: paymentIntent.id,
      provider: 'legacy_stripe',
      operatorId: request.operatorId,
    });

    await this.audit.log({
      userId: request.operatorId,
      action: 'ADMIN_POS_CHARGE_INITIATED',
      severity: 'high',
      metadata: {
        targetUserId: user.id,
        correlationId,
        paymentIntentId: paymentIntent.id,
        provider: 'legacy_stripe',
        amountMinor: request.amountMinor,
        currency: 'USD',
      },
    });

    return {
      correlationId,
      provider: 'legacy_stripe',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      currency: 'USD',
      amountMinor: request.amountMinor,
    };
  }

  async createRefund(request: PosRefundRequest): Promise<PosRefundResult> {
    const correlationId = request.correlationId || crypto.randomUUID();
    const provider = await this.resolveRefundProvider(request.paymentIntentId);

    if (provider === 'conekta') {
      throw new BadRequestException(
        'Conekta POS refunds are webhook-driven; use the Conekta dashboard or wait for charge.refunded'
      );
    }

    let refund;
    if (provider === 'stripe_mx') {
      if (!this.stripeMx.isConfigured()) {
        throw new ServiceUnavailableException('Stripe MX is not configured');
      }
      refund = await this.stripeMx.createRefund({
        paymentIntentId: request.paymentIntentId,
        amountMinor: request.amountMinor,
        reason: request.reason,
        metadata: {
          correlation_id: correlationId,
          operator_id: request.operatorId,
          source: 'internal_pos',
        },
      });
    } else {
      refund = await this.stripe.createRefund({
        paymentIntentId: request.paymentIntentId,
        amountMinor: request.amountMinor,
        reason: request.reason,
        metadata: {
          correlation_id: correlationId,
          operator_id: request.operatorId,
          source: 'internal_pos',
        },
      });
    }

    const userId =
      (refund.metadata?.dhanam_user_id as string | undefined) ||
      (await this.lookupUserIdForPaymentIntent(request.paymentIntentId));

    if (userId) {
      await this.recordPosEvent(
        userId,
        'refund_issued',
        refund.amount,
        refund.currency.toUpperCase() as Currency,
        {
          correlationId,
          refundId: refund.id,
          paymentIntentId: request.paymentIntentId,
          provider,
          operatorId: request.operatorId,
        }
      );
    }

    await this.audit.log({
      userId: request.operatorId,
      action: 'ADMIN_POS_REFUND_INITIATED',
      severity: 'high',
      metadata: {
        correlationId,
        refundId: refund.id,
        paymentIntentId: request.paymentIntentId,
        provider,
        amountMinor: refund.amount,
        currency: refund.currency.toUpperCase(),
      },
    });

    this.logger.log(
      `POS refund ${refund.id} for PI ${request.paymentIntentId} by operator ${request.operatorId}`
    );

    return {
      correlationId,
      refundId: refund.id,
      provider,
      status: refund.status,
      amountMinor: refund.amount,
      currency: refund.currency.toUpperCase(),
    };
  }

  async getTimeline(correlationId: string): Promise<PosTimelineEntry[]> {
    const events = await this.prisma.billingEvent.findMany({
      where: {
        metadata: {
          path: ['correlationId'],
          equals: correlationId,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const paymentReferences = new Set<string>();
    for (const event of events) {
      const meta = event.metadata as Record<string, unknown> | null;
      if (typeof meta?.paymentIntentId === 'string') {
        paymentReferences.add(meta.paymentIntentId);
      }
      if (typeof meta?.payment_id === 'string') {
        paymentReferences.add(meta.payment_id);
      }
    }

    const deliveryRows =
      paymentReferences.size > 0
        ? await this.prisma.webhookDeliveryFailure.findMany({
            where: {
              OR: Array.from(paymentReferences).map((ref) => ({
                payload: {
                  path: ['data', 'payment_id'],
                  equals: ref,
                },
              })),
            },
            orderBy: { createdAt: 'asc' },
            take: 50,
          })
        : [];

    const deliveriesByPayment = new Map<string, PosProductWebhookDelivery[]>();
    for (const row of deliveryRows) {
      const payload = row.payload as { data?: { payment_id?: string }; type?: string };
      const paymentId = payload.data?.payment_id;
      if (!paymentId) {
        continue;
      }
      const list = deliveriesByPayment.get(paymentId) ?? [];
      list.push({
        consumer: row.consumer,
        status: row.resolvedAt ? 'resolved' : 'failed',
        eventType: row.eventType,
        lastError: row.lastErrorMessage,
      });
      deliveriesByPayment.set(paymentId, list);
    }

    return events.map((event) => {
      const meta = (event.metadata as Record<string, unknown> | null) ?? {};
      const paymentRef =
        (typeof meta.paymentIntentId === 'string' && meta.paymentIntentId) ||
        (typeof meta.payment_id === 'string' && meta.payment_id) ||
        null;
      const cfdiUuid =
        (typeof meta.cfdiUuid === 'string' && meta.cfdiUuid) ||
        (typeof meta.cfdi_uuid === 'string' && meta.cfdi_uuid) ||
        null;

      return {
        id: event.id,
        type: event.type,
        status: event.status,
        amount: event.amount.toString(),
        currency: event.currency,
        createdAt: event.createdAt,
        metadata: event.metadata,
        cfdiUuid,
        productWebhookDeliveries: paymentRef ? deliveriesByPayment.get(paymentRef) : undefined,
      };
    });
  }

  async getReconciliationSummary(limit = 25): Promise<PosReconciliationSummary> {
    const [flaggedCount, recentMismatches] = await Promise.all([
      this.prisma.billingEvent.count({
        where: { type: 'reconciliation_mismatch', status: 'flagged' },
      }),
      this.prisma.billingEvent.findMany({
        where: { type: 'reconciliation_mismatch', status: 'flagged' },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return {
      flaggedCount,
      recentMismatches: recentMismatches.map((event) => ({
        id: event.id,
        userId: event.userId,
        type: event.type,
        status: event.status,
        createdAt: event.createdAt,
        metadata: event.metadata,
      })),
    };
  }

  private async resolveRefundProvider(paymentIntentId: string): Promise<PosProvider> {
    const prior = await this.prisma.billingEvent.findFirst({
      where: {
        metadata: {
          path: ['paymentIntentId'],
          equals: paymentIntentId,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true },
    });

    const provider = (prior?.metadata as { provider?: string } | null)?.provider;
    if (provider === 'stripe_mx' || provider === 'legacy_stripe' || provider === 'conekta') {
      return provider;
    }

    if (paymentIntentId.startsWith('ord_')) {
      return 'conekta';
    }

    if (this.stripeMx.isConfigured()) {
      return 'stripe_mx';
    }

    return 'legacy_stripe';
  }

  private async lookupUserIdForPaymentIntent(paymentIntentId: string): Promise<string | null> {
    const event = await this.prisma.billingEvent.findFirst({
      where: {
        metadata: {
          path: ['paymentIntentId'],
          equals: paymentIntentId,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true },
    });
    return event?.userId ?? null;
  }

  private async recordPosEvent(
    userId: string,
    type: 'payment_succeeded' | 'refund_issued',
    amountMinor: number,
    currency: Currency,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.prisma.billingEvent.create({
      data: {
        userId,
        type,
        status: 'pending',
        amount: amountMinor,
        currency,
        metadata: {
          ...metadata,
          pos: true,
        } as Prisma.InputJsonValue,
      },
    });
  }
}
