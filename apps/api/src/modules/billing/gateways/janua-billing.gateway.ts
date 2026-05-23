import { Injectable } from '@nestjs/common';

import { JanuaBillingService } from '../janua-billing.service';

import { PaymentGatewayPort } from './payment-gateway.port';
import {
  GatewayCheckoutInput,
  GatewayCheckoutResult,
  GatewayProviderConfig,
  PaymentGatewayCapabilities,
} from './payment-gateway.types';

/**
 * Optional Janua-mediated checkout adapter. Active only when
 * `JANUA_BILLING_ENABLED=true` and `JANUA_API_KEY` is set.
 */
@Injectable()
export class JanuaBillingGateway implements PaymentGatewayPort {
  readonly id = 'janua' as const;

  readonly capabilities: PaymentGatewayCapabilities = {
    subscriptionCheckout: true,
    oneOffPosCharge: false,
    refunds: false,
    webhookVerification: false,
  };

  constructor(private readonly januaBilling: JanuaBillingService) {}

  isConfigured(): boolean {
    return this.januaBilling.isEnabled();
  }

  getProviderConfig(countryCode: string): GatewayProviderConfig {
    const isMexico = countryCode.toUpperCase() === 'MX';
    return {
      currency: isMexico ? 'MXN' : 'USD',
      paymentMethods: isMexico ? ['card', 'spei', 'oxxo'] : ['card'],
      taxHandling: 'automatic',
    };
  }

  async createSubscriptionCheckout(input: GatewayCheckoutInput): Promise<GatewayCheckoutResult> {
    if (!input.customerId) {
      throw new Error('Janua checkout requires customerId from createCustomer');
    }

    const result = await this.januaBilling.createCheckoutSession({
      customerId: input.customerId,
      customerEmail: input.customerEmail,
      priceId: input.priceId,
      countryCode: input.countryCode,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      orgId: input.orgId,
      metadata: input.metadata,
    });

    const config = this.getProviderConfig(input.countryCode);

    return {
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId,
      currency: config.currency,
    };
  }
}
