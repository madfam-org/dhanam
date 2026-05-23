import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StripeService } from '../stripe.service';

import { PaymentGatewayPort } from './payment-gateway.port';
import {
  GatewayCheckoutInput,
  GatewayCheckoutResult,
  GatewayPosChargeInput,
  GatewayPosChargeResult,
  GatewayProviderConfig,
  GatewayRefundInput,
  GatewayRefundResult,
  PaymentGatewayCapabilities,
} from './payment-gateway.types';

@Injectable()
export class LegacyStripeGateway implements PaymentGatewayPort {
  readonly id = 'legacy_stripe' as const;

  readonly capabilities: PaymentGatewayCapabilities = {
    subscriptionCheckout: true,
    oneOffPosCharge: true,
    refunds: true,
    webhookVerification: true,
  };

  constructor(
    private readonly stripe: StripeService,
    private readonly config: ConfigService
  ) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('STRIPE_SECRET_KEY'));
  }

  getProviderConfig(_countryCode: string): GatewayProviderConfig {
    return {
      currency: 'USD',
      paymentMethods: ['card'],
      taxHandling: 'manual',
    };
  }

  async createSubscriptionCheckout(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult> {
    const session = await this.stripe.createCheckoutSession({
      customerId: input.customerId,
      priceId: input.priceId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: input.metadata,
    });

    return {
      checkoutUrl: session.url!,
      sessionId: session.id,
      currency: 'USD',
    };
  }

  async createPosCharge(input: GatewayPosChargeInput): Promise<GatewayPosChargeResult> {
    if (input.currency.toLowerCase() !== 'usd') {
      throw new Error('Legacy Stripe POS supports USD only');
    }

    const paymentIntent = await this.stripe.createPaymentIntent({
      amount: input.amountMinor,
      currency: 'usd',
      customerEmail: input.customerEmail,
      customerId: input.customerId,
      description: input.description,
      metadata: input.metadata,
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      currency: 'USD',
      amountMinor: input.amountMinor,
    };
  }

  async createRefund(input: GatewayRefundInput): Promise<GatewayRefundResult> {
    const refund = await this.stripe.createRefund({
      paymentIntentId: input.paymentIntentId,
      amountMinor: input.amountMinor,
      reason: input.reason,
      metadata: input.metadata,
    });

    return {
      refundId: refund.id,
      status: refund.status,
      amountMinor: refund.amount,
      currency: refund.currency.toUpperCase(),
      metadata: refund.metadata as Record<string, unknown> | undefined,
    };
  }
}
