import { Injectable, Logger } from '@nestjs/common';

import { CheckoutRouteProvider } from '../services/checkout-routing-policy.service';

import { ConektaGateway } from './conekta.gateway';
import { JanuaBillingGateway } from './janua-billing.gateway';
import { LegacyStripeGateway } from './legacy-stripe.gateway';
import { PaddleGateway } from './paddle.gateway';
import { PaymentGatewayPort } from './payment-gateway.port';
import { PaymentGatewayId } from './payment-gateway.types';
import { StripeMxGateway } from './stripe-mx.gateway';

export type PosProvider = 'stripe_mx' | 'legacy_stripe' | 'conekta';

@Injectable()
export class PaymentGatewayRegistry {
  private readonly logger = new Logger(PaymentGatewayRegistry.name);
  private readonly gateways: Map<PaymentGatewayId, PaymentGatewayPort>;

  constructor(
    stripeMxGateway: StripeMxGateway,
    paddleGateway: PaddleGateway,
    conektaGateway: ConektaGateway,
    januaBillingGateway: JanuaBillingGateway,
    legacyStripeGateway: LegacyStripeGateway
  ) {
    this.gateways = new Map<PaymentGatewayId, PaymentGatewayPort>([
      [stripeMxGateway.id, stripeMxGateway],
      [paddleGateway.id, paddleGateway],
      [conektaGateway.id, conektaGateway],
      [januaBillingGateway.id, januaBillingGateway],
      [legacyStripeGateway.id, legacyStripeGateway],
    ]);

    const configured = this.list()
      .filter((gateway) => gateway.isConfigured())
      .map((g) => g.id);
    this.logger.log(
      configured.length > 0
        ? `Payment gateways registered: ${configured.join(', ')}`
        : 'Payment gateways registered (none configured in this environment)'
    );
  }

  list(): PaymentGatewayPort[] {
    return Array.from(this.gateways.values());
  }

  get(id: PaymentGatewayId): PaymentGatewayPort | undefined {
    return this.gateways.get(id);
  }

  require(id: PaymentGatewayId): PaymentGatewayPort {
    const gateway = this.get(id);
    if (!gateway) {
      throw new Error(`Unknown payment gateway: ${id}`);
    }
    return gateway;
  }

  isConfigured(id: PaymentGatewayId): boolean {
    return this.get(id)?.isConfigured() ?? false;
  }

  /** Hybrid subscription checkout target for a country (excludes janua/legacy). */
  resolveHybridCheckoutGateway(countryCode: string): PaymentGatewayId | null {
    const normalized = countryCode.toUpperCase();
    if (normalized === 'MX' && this.isConfigured('stripe_mx')) {
      return 'stripe_mx';
    }
    if (normalized !== 'MX') {
      // International: prefer Paddle (Merchant of Record) once configured; until
      // then fall back to the Mexico Stripe account (multi-currency presentment,
      // settles MXN→BBVA) so global card sales work on a single account. This
      // auto-switches to Paddle MoR when it is provisioned — no further change.
      if (this.isConfigured('paddle')) {
        return 'paddle';
      }
      if (this.isConfigured('stripe_mx')) {
        return 'stripe_mx';
      }
    }
    return null;
  }

  isHybridCheckoutAvailable(countryCode: string): boolean {
    return this.resolveHybridCheckoutGateway(countryCode) !== null;
  }

  /** Maps checkout route provider ids to registry gateway ids. */
  toGatewayId(provider: CheckoutRouteProvider): PaymentGatewayId {
    return provider;
  }

  /**
   * POS auto-routing: MXN + MX prefers Stripe MX, then Conekta, else legacy USD.
   */
  resolvePosGateway(params: {
    countryCode: string;
    currency: string;
    providerChoice: PosProvider | 'auto';
  }): PosProvider {
    const { countryCode, currency, providerChoice } = params;
    const normalizedCountry = countryCode.toUpperCase();
    const normalizedCurrency = currency.toLowerCase();

    if (providerChoice !== 'auto') {
      return providerChoice;
    }

    const useConekta =
      normalizedCountry === 'MX' &&
      normalizedCurrency === 'mxn' &&
      !this.isConfigured('stripe_mx') &&
      this.isConfigured('conekta');

    if (useConekta) {
      return 'conekta';
    }

    if (
      normalizedCountry === 'MX' &&
      normalizedCurrency === 'mxn' &&
      this.isConfigured('stripe_mx')
    ) {
      return 'stripe_mx';
    }

    return 'legacy_stripe';
  }
}
