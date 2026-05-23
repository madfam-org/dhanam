import { BadRequestException, Injectable } from '@nestjs/common';

import { ConektaService } from '../services/conekta.service';

import { PaymentGatewayPort } from './payment-gateway.port';
import {
  GatewayPosChargeInput,
  GatewayPosChargeResult,
  PaymentGatewayCapabilities,
} from './payment-gateway.types';

@Injectable()
export class ConektaGateway implements PaymentGatewayPort {
  readonly id = 'conekta' as const;

  readonly capabilities: PaymentGatewayCapabilities = {
    subscriptionCheckout: false,
    oneOffPosCharge: true,
    refunds: false,
    webhookVerification: true,
  };

  constructor(private readonly conekta: ConektaService) {}

  isConfigured(): boolean {
    return this.conekta.isConfigured();
  }

  supportsCountry(countryCode: string): boolean {
    return countryCode.toUpperCase() === 'MX';
  }

  async createPosCharge(input: GatewayPosChargeInput): Promise<GatewayPosChargeResult> {
    const paymentSource =
      input.paymentMethod === 'oxxo' ? { type: 'oxxo_cash' as const } : { type: 'spei' as const };

    const charge = await this.conekta.createCharge({
      amount: input.amountMinor,
      currency: 'MXN',
      customerInfo: {
        name: input.customerName || input.customerEmail,
        email: input.customerEmail,
      },
      paymentSource,
      description: input.description,
      metadata: {
        ...Object.fromEntries(
          Object.entries(input.metadata).map(([key, value]) => [key, String(value)])
        ),
        idempotency_key: input.metadata.correlation_id ?? input.metadata.idempotency_key ?? '',
      },
    });

    return {
      paymentIntentId: charge.orderId,
      clientSecret: charge.paymentInstructions?.reference ?? null,
      status: charge.paymentStatus,
      currency: 'MXN',
      amountMinor: input.amountMinor,
      chargeId: charge.chargeId,
      paymentReference: charge.paymentInstructions?.reference ?? null,
    };
  }

  async createRefund(): Promise<never> {
    throw new BadRequestException(
      'Conekta POS refunds are webhook-driven; use the Conekta dashboard or wait for charge.refunded'
    );
  }
}
