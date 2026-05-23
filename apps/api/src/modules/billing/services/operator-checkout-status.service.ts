import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';

import { PrismaService } from '@core/prisma/prisma.service';

import { StripeService } from '../stripe.service';

import { OperatorCheckoutStatus } from './subscription-lifecycle.service';

@Injectable()
export class OperatorCheckoutStatusService {
  constructor(
    private prisma: PrismaService,
    private stripe: StripeService
  ) {}

  async getOperatorCheckoutStatus(sessionId: string): Promise<OperatorCheckoutStatus> {
    const session = await this.stripe.retrieveCheckoutSession(sessionId, {
      expand: ['subscription', 'payment_intent'],
    });

    const metadata = session.metadata || {};
    const userId = metadata.userId || metadata.janua_user_id || null;
    const billingEvents = userId
      ? await this.prisma.billingEvent.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [];

    return {
      sessionId: session.id,
      provider: 'stripe',
      status: session.status || null,
      paymentStatus: session.payment_status || null,
      customerId: stripeObjectId(session.customer),
      subscriptionId: stripeObjectId(session.subscription),
      paymentIntentId: stripeObjectId(session.payment_intent),
      userId,
      product: metadata.product || null,
      plan: metadata.plan || metadata.planId || null,
      source: metadata.source || null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency || null,
      createdAt: unixToIso(session.created),
      expiresAt: unixToIso(session.expires_at),
      checkoutUrl: session.url || null,
      billingEvents: billingEvents.map((event) => ({
        id: event.id,
        type: event.type,
        status: event.status,
        amount: event.amount.toString(),
        currency: event.currency,
        createdAt: event.createdAt,
        metadata: event.metadata,
      })),
    };
  }
}

function stripeObjectId(
  value:
    | string
    | Stripe.Customer
    | Stripe.Subscription
    | Stripe.PaymentIntent
    | Stripe.DeletedCustomer
    | null
    | undefined
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return value.id || null;
}

function unixToIso(value?: number | null): string | null {
  return value ? new Date(value * 1000).toISOString() : null;
}
