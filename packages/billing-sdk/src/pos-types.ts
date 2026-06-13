import type { BillingProvider } from './types';

export interface PosClientConfig {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
}

export interface PosRoutePreviewRequest {
  userId: string;
  plan: string;
  product?: string;
  countryCode?: string;
}

export interface PosRoutePreviewResult {
  provider: string;
  routeReason: string;
  countryCode: string;
  currency: string;
  paymentMethods: string[];
  catalogPlanId: string;
}

export interface PosRouteOverrideRequest {
  userId: string;
  product?: string;
  provider: BillingProvider | 'legacy_stripe' | 'janua';
  countryCode?: string;
  reason: string;
  ttlHours?: number;
}

export interface PosChargeRequest {
  userId: string;
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethod?: 'card' | 'oxxo' | 'customer_balance';
  correlationId?: string;
  countryCode?: string;
  provider?: BillingProvider | 'legacy_stripe';
}

export interface PosChargeResult {
  correlationId: string;
  provider: string;
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
}

export interface PosRefundResult {
  correlationId: string;
  refundId: string;
  provider: string;
  status: string | null;
  amountMinor: number;
  currency: string;
}

export interface PosTimelineEntry {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  cfdiUuid?: string | null;
}

export interface PosReconciliationSummary {
  flaggedCount: number;
  recentMismatches: Array<{
    id: string;
    userId: string | null;
    createdAt: string;
  }>;
}
