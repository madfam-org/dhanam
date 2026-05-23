import { Injectable } from '@nestjs/common';

import { PaddleService } from '../services/paddle.service';

import { PaymentGatewayPort } from './payment-gateway.port';
import {
  GatewayCheckoutInput,
  GatewayCheckoutResult,
  GatewayProviderConfig,
  PaymentGatewayCapabilities,
} from './payment-gateway.types';

@Injectable()
export class PaddleGateway implements PaymentGatewayPort {
  readonly id = 'paddle' as const;

  readonly capabilities: PaymentGatewayCapabilities = {
    subscriptionCheckout: true,
    oneOffPosCharge: false,
    refunds: false,
    webhookVerification: true,
  };

  constructor(private readonly paddle: PaddleService) {}

  isConfigured(): boolean {
    return this.paddle.isConfigured();
  }

  supportsCountry(countryCode: string): boolean {
    return countryCode.toUpperCase() !== 'MX';
  }

  getProviderConfig(_countryCode: string): GatewayProviderConfig {
    return {
      currency: 'USD',
      paymentMethods: ['card', 'paypal', 'apple_pay', 'google_pay'],
      taxHandling: 'merchant-of-record',
    };
  }

  async createSubscriptionCheckout(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult> {
    const transaction = await this.paddle.createTransaction({
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      priceId: input.priceId,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      countryCode: input.countryCode,
      metadata: input.metadata,
    });

    return {
      checkoutUrl: transaction.checkoutUrl,
      sessionId: transaction.transactionId,
      currency: 'USD',
    };
  }
}
