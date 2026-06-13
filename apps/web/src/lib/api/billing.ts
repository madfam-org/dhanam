import { apiClient } from './client';

export interface UsageMetrics {
  date: string;
  tier: 'community' | 'essentials' | 'pro' | 'premium';
  usage: {
    esg_calculation: { used: number; limit: number };
    monte_carlo_simulation: { used: number; limit: number };
    goal_probability: { used: number; limit: number };
    scenario_analysis: { used: number; limit: number };
    portfolio_rebalance: { used: number; limit: number };
    api_request: { used: number; limit: number };
  };
}

export interface BillingEvent {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface SubscriptionStatus {
  tier: 'community' | 'essentials' | 'pro' | 'premium';
  startedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  isInTrial: boolean;
  isInPromo: boolean;
  trialEndsAt: string | null;
  promoEndsAt: string | null;
}

export interface RegionalPrice {
  id: string;
  name: string;
  monthlyPrice: number;
  promoPrice: number | null;
  currency: string;
  features: string[];
}

export interface PricingResponse {
  region: number;
  regionName: string;
  currency: string;
  tiers: RegionalPrice[];
  trial: {
    daysWithoutCC: number;
    daysWithCC: number;
    promoMonths: number;
  };
}

export interface UpgradeResponse {
  checkoutUrl: string;
  provider: string;
}

export interface CheckoutInstrumentSuggestion {
  paymentMethod: string;
  label: string;
  provider: string;
  merchantFeeMinor: number;
  totalEconomicCostMinor: number;
  recommended: boolean;
  savingsVsWorstMinor: number;
}

export interface CheckoutRouteRecommendation {
  provider: string;
  routeReason: string;
  countryCode: string;
  currency: string;
  amountMinor: number;
  paymentMethods: string[];
  feeOptimization?: {
    merchantFeeMinor: number;
    totalEconomicCostMinor: number;
    savingsVsCardMinor: number | null;
    recommendedPaymentMethod: string;
    instrumentSuggestions: CheckoutInstrumentSuggestion[];
  } | null;
}

export const billingApi = {
  /**
   * Get current usage metrics for the authenticated user
   */
  async getUsage(): Promise<UsageMetrics> {
    return apiClient.get<UsageMetrics>('/billing/usage');
  },

  /**
   * Get billing history for the authenticated user
   */
  async getHistory(limit = 20): Promise<BillingEvent[]> {
    return apiClient.get<BillingEvent[]>('/billing/history', { limit });
  },

  /**
   * Get subscription status for the authenticated user
   */
  async getStatus(): Promise<SubscriptionStatus> {
    return apiClient.get<SubscriptionStatus>('/billing/status');
  },

  /**
   * Initiate upgrade to premium subscription
   */
  async upgradeToPremium(options: {
    orgId?: string;
    plan?: string;
    successUrl?: string;
    cancelUrl?: string;
    countryCode?: string;
    paymentMethod?: string;
  }): Promise<UpgradeResponse> {
    return apiClient.post<UpgradeResponse>('/billing/upgrade', options);
  },

  /**
   * Create billing portal session for subscription management
   */
  async createPortalSession(): Promise<{ portalUrl: string }> {
    return apiClient.post<{ portalUrl: string }>('/billing/portal');
  },

  /**
   * Get regional pricing (public, no auth required)
   */
  async getPricing(countryCode?: string): Promise<PricingResponse> {
    return apiClient.get<PricingResponse>('/billing/pricing', {
      country: countryCode,
    });
  },

  /**
   * Fee-optimal checkout route + payment instrument suggestions (public).
   */
  async getCheckoutRouteRecommendation(params: {
    country: string;
    plan?: string;
    product?: string;
    amountMinor?: number;
    currency?: string;
    paymentMethod?: string;
  }): Promise<CheckoutRouteRecommendation> {
    return apiClient.get<CheckoutRouteRecommendation>('/billing/checkout/route-recommendation', {
      country: params.country,
      plan: params.plan,
      product: params.product,
      amountMinor: params.amountMinor,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
    });
  },

  /**
   * Start a free trial
   */
  async startTrial(plan: string): Promise<{ message: string; plan: string; trialDays: number }> {
    return apiClient.post('/billing/trial/start', { plan });
  },

  /**
   * Extend trial with credit card
   */
  async extendTrial(): Promise<{ message: string }> {
    return apiClient.post('/billing/trial/extend');
  },
};
