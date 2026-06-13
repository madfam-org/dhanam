import { Injectable } from '@nestjs/common';

import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';
import {
  estimateProcessingFeeMinor,
  PaymentInstrumentId,
  RoutableCheckoutProvider,
  scheduleAppliesToCountry,
} from '../config/payment-route-fee-schedule';

import type { CheckoutRouteProvider } from './checkout-routing-policy.service';
import { PaymentRouteFeeScheduleService } from './payment-route-fee-schedule.service';

export interface PaymentRouteOptimizerInput {
  countryCode: string;
  amountMinor: number;
  currency: string;
  paymentMethod?: PaymentInstrumentId;
  /** Subscription-capable providers only (excludes conekta unless explicitly allowed). */
  subscriptionCheckout?: boolean;
}

export interface PaymentInstrumentSuggestion {
  paymentMethod: PaymentInstrumentId;
  label: string;
  provider: RoutableCheckoutProvider;
  merchantFeeMinor: number;
  totalEconomicCostMinor: number;
  recommended: boolean;
  savingsVsWorstMinor: number;
}

export interface PaymentRouteRecommendation {
  provider: CheckoutRouteProvider;
  paymentMethod: PaymentInstrumentId;
  routeReason: string;
  currency: string;
  merchantFeeMinor: number;
  totalEconomicCostMinor: number;
  savingsVsCardMinor: number | null;
  instrumentSuggestions: PaymentInstrumentSuggestion[];
}

const SUBSCRIPTION_PROVIDERS: RoutableCheckoutProvider[] = ['stripe_mx', 'paddle', 'legacy_stripe'];

@Injectable()
export class PaymentRouteOptimizerService {
  constructor(
    private gatewayRegistry: PaymentGatewayRegistry,
    private feeSchedule: PaymentRouteFeeScheduleService
  ) {}

  recommend(input: PaymentRouteOptimizerInput): PaymentRouteRecommendation | null {
    const countryCode = input.countryCode.toUpperCase();
    const candidates = this.buildCandidates(input, countryCode);
    if (candidates.length === 0) {
      return null;
    }

    const filtered = input.paymentMethod
      ? candidates.filter((c) => c.paymentMethod === input.paymentMethod)
      : candidates;

    const ranked = (filtered.length > 0 ? filtered : candidates).sort(
      (a, b) => a.totalEconomicCostMinor - b.totalEconomicCostMinor
    );

    const best = ranked[0];
    const worstCost = Math.max(...candidates.map((c) => c.totalEconomicCostMinor));
    const cardBaseline = candidates.find(
      (c) => c.paymentMethod === 'card' && c.provider === best.provider
    );

    const instrumentSuggestions = this.buildInstrumentSuggestions(candidates, best, worstCost);

    return {
      provider: this.toCheckoutRouteProvider(best.provider),
      paymentMethod: best.paymentMethod,
      routeReason: input.paymentMethod
        ? `fee_optimal_${best.provider}_${best.paymentMethod}`
        : `fee_optimal_${best.provider}`,
      currency: best.currency,
      merchantFeeMinor: best.merchantFeeMinor,
      totalEconomicCostMinor: best.totalEconomicCostMinor,
      savingsVsCardMinor: cardBaseline
        ? Math.max(0, cardBaseline.totalEconomicCostMinor - best.totalEconomicCostMinor)
        : null,
      instrumentSuggestions,
    };
  }

  private buildCandidates(
    input: PaymentRouteOptimizerInput,
    countryCode: string
  ): Array<{
    provider: RoutableCheckoutProvider;
    paymentMethod: PaymentInstrumentId;
    currency: string;
    merchantFeeMinor: number;
    customerFxCostMinor: number;
    totalEconomicCostMinor: number;
    label: string;
  }> {
    const allowProviders = this.configuredProviders(input.subscriptionCheckout !== false);
    const out: Array<{
      provider: RoutableCheckoutProvider;
      paymentMethod: PaymentInstrumentId;
      currency: string;
      merchantFeeMinor: number;
      customerFxCostMinor: number;
      totalEconomicCostMinor: number;
      label: string;
    }> = [];

    for (const entry of this.feeSchedule.getEntries()) {
      if (!allowProviders.has(entry.provider)) {
        continue;
      }
      if (!scheduleAppliesToCountry(entry, countryCode)) {
        continue;
      }
      if (entry.currency !== input.currency.toUpperCase()) {
        continue;
      }

      const fees = estimateProcessingFeeMinor(input.amountMinor, entry);
      out.push({
        provider: entry.provider,
        paymentMethod: entry.paymentMethod,
        currency: entry.currency,
        label: entry.label,
        ...fees,
      });
    }

    return out;
  }

  private configuredProviders(subscriptionCheckout: boolean): Set<RoutableCheckoutProvider> {
    const allowed = new Set<RoutableCheckoutProvider>();
    const check = (
      provider: RoutableCheckoutProvider,
      gatewayId: Parameters<PaymentGatewayRegistry['isConfigured']>[0]
    ) => {
      if (this.gatewayRegistry.isConfigured(gatewayId)) {
        allowed.add(provider);
      }
    };

    check('stripe_mx', 'stripe_mx');
    check('paddle', 'paddle');
    check('legacy_stripe', 'legacy_stripe');
    check('conekta', 'conekta');

    if (subscriptionCheckout) {
      allowed.delete('conekta');
      for (const provider of [...allowed]) {
        if (!SUBSCRIPTION_PROVIDERS.includes(provider)) {
          allowed.delete(provider);
        }
      }
    }

    return allowed;
  }

  private buildInstrumentSuggestions(
    candidates: Array<{
      provider: RoutableCheckoutProvider;
      paymentMethod: PaymentInstrumentId;
      label: string;
      merchantFeeMinor: number;
      totalEconomicCostMinor: number;
    }>,
    best: { provider: RoutableCheckoutProvider; paymentMethod: PaymentInstrumentId },
    worstCost: number
  ): PaymentInstrumentSuggestion[] {
    const byProvider = candidates.filter((c) => c.provider === best.provider);
    const deduped = new Map<string, (typeof candidates)[number]>();
    for (const row of byProvider) {
      const key = row.paymentMethod;
      const existing = deduped.get(key);
      if (!existing || row.totalEconomicCostMinor < existing.totalEconomicCostMinor) {
        deduped.set(key, row);
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => a.totalEconomicCostMinor - b.totalEconomicCostMinor)
      .map((row) => ({
        paymentMethod: row.paymentMethod,
        label: row.label,
        provider: row.provider,
        merchantFeeMinor: row.merchantFeeMinor,
        totalEconomicCostMinor: row.totalEconomicCostMinor,
        recommended: row.provider === best.provider && row.paymentMethod === best.paymentMethod,
        savingsVsWorstMinor: Math.max(0, worstCost - row.totalEconomicCostMinor),
      }));
  }

  private toCheckoutRouteProvider(provider: RoutableCheckoutProvider): CheckoutRouteProvider {
    if (provider === 'conekta') {
      // Conekta is POS-only today; callers should not reach here for subscriptions.
      return 'stripe_mx';
    }
    return provider;
  }
}
