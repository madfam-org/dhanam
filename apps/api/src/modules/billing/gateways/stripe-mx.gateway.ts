import { Injectable } from '@nestjs/common';

import { StripeMxService } from '../services/stripe-mx.service';

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
export class StripeMxGateway implements PaymentGatewayPort {
  readonly id = 'stripe_mx' as const;

  readonly capabilities: PaymentGatewayCapabilities = {
    subscriptionCheckout: true,
    oneOffPosCharge: true,
    refunds: true,
    webhookVerification: true,
  };

  constructor(private readonly stripeMx: StripeMxService) {}

  isConfigured(): boolean {
    return this.stripeMx.isConfigured();
  }

  supportsCountry(countryCode: string): boolean {
    return countryCode.toUpperCase() === 'MX';
  }

  getProviderConfig(_countryCode: string): GatewayProviderConfig {
    return {
      currency: 'MXN',
      paymentMethods: ['card', 'oxxo', 'customer_balance'],
      taxHandling: 'automatic',
    };
  }

  async createSubscriptionCheckout(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult> {
    const session = await this.stripeMx.createCheckoutSession({
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      priceId: input.priceId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: input.metadata,
      paymentMethods: ['card', 'oxxo', 'customer_balance'],
    });

    return {
      checkoutUrl: session.url!,
      sessionId: session.id,
      currency: 'MXN',
    };
  }

  async createPosCharge(input: GatewayPosChargeInput): Promise<GatewayPosChargeResult> {
    const paymentIntent = await this.stripeMx.createPaymentIntent({
      amount: input.amountMinor,
      customerEmail: input.customerEmail,
      customerId: input.customerId,
      description: input.description,
      paymentMethod:
        input.paymentMethod === 'spei' ? 'customer_balance' : input.paymentMethod || 'card',
      metadata: input.metadata,
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
      currency: 'MXN',
      amountMinor: input.amountMinor,
    };
  }

  async createRefund(input: GatewayRefundInput): Promise<GatewayRefundResult> {
    const refund = await this.stripeMx.createRefund({
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
