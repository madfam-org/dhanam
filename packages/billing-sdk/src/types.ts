// ────────────────────────────────────────────────
// Enums & Literals
// ────────────────────────────────────────────────

/** Product identifiers in the MADFAM ecosystem */
export type ProductId = 'enclii' | 'tezca' | 'yantra4d' | 'dhanam';

/** Subscription tier levels */
export type SubscriptionTier = 'community' | 'essentials' | 'pro' | 'madfam';

/** Plan slug for checkout and upgrade flows (optionally product-prefixed) */
export type PlanSlug =
  | 'essentials'
  | 'pro'
  | 'madfam'
  | 'essentials_yearly'
  | 'pro_yearly'
  | 'madfam_yearly'
  | `${ProductId}_essentials`
  | `${ProductId}_pro`
  | `${ProductId}_madfam`;

/** Supported billing payment providers */
export type BillingProvider = 'conekta' | 'polar' | 'stripe';

/** Usage metric types tracked by the billing system */
export type UsageMetricType =
  | 'esg_calculation'
  | 'monte_carlo_simulation'
  | 'goal_probability'
  | 'scenario_analysis'
  | 'portfolio_rebalance'
  | 'api_request';

// ────────────────────────────────────────────────
// Webhook Types
// ────────────────────────────────────────────────

/** Webhook event types dispatched by the Dhanam billing system */
export enum DhanamWebhookEventType {
  // Subscription lifecycle
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_EXPIRED = 'subscription.expired',

  // Payment lifecycle
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',

  // Customer lifecycle
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
}

/** Data payload attached to every webhook event */
export interface DhanamWebhookData {
  customer_id?: string;
  subscription_id?: string;
  plan_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  provider?: BillingProvider;
  metadata?: Record<string, unknown>;
}

/** Top-level webhook envelope */
export interface DhanamWebhookPayload {
  id: string;
  type: DhanamWebhookEventType;
  timestamp: string;
  data: DhanamWebhookData;
  source_app?: string;
}

// ────────────────────────────────────────────────
// Request / Response Types
// ────────────────────────────────────────────────

/** Options for building a public checkout URL */
export interface CheckoutOptions {
  plan: PlanSlug;
  userId: string;
  returnUrl: string;
  /** Product being upgraded (defaults to 'dhanam') */
  product?: ProductId;
}

/** Options for initiating an authenticated upgrade */
export interface UpgradeOptions {
  successUrl?: string;
  cancelUrl?: string;
  orgId?: string;
  plan?: string;
  countryCode?: string;
  /** Product being upgraded (defaults to 'dhanam') */
  product?: ProductId;
}

/** Result of a checkout or upgrade request */
export interface CheckoutResult {
  checkoutUrl: string;
  provider: BillingProvider;
}

/** Result of creating a billing portal session */
export interface PortalResult {
  portalUrl: string;
}

/** Current subscription status */
export interface SubscriptionStatus {
  tier: SubscriptionTier;
  startedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
}

/** Single usage metric bucket */
export interface UsageBucket {
  used: number;
  limit: number;
}

/** Full usage response */
export interface UsageMetrics {
  date: string;
  tier: SubscriptionTier;
  usage: Partial<Record<UsageMetricType, UsageBucket>>;
}

/** Single billing history event */
export interface BillingEvent {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/** Billing history response */
export interface BillingHistory {
  events: BillingEvent[];
}

// ────────────────────────────────────────────────
// Client Configuration
// ────────────────────────────────────────────────

/** Configuration for DhanamClient */
export interface DhanamClientConfig {
  /** Base URL of the Dhanam API (e.g. "https://api.dhan.am") */
  baseUrl: string;

  /**
   * Bearer token for authenticated endpoints.
   * Can be a string or an async function that returns a fresh token.
   */
  token?: string | (() => string | Promise<string>);

  /** Optional custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}
