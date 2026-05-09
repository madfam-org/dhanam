// ────────────────────────────────────────────────
// Enums & Literals
// ────────────────────────────────────────────────

/**
 * Product identifiers in the MADFAM ecosystem.
 * Known values are provided for autocomplete; any lowercase alphanumeric
 * string is accepted at runtime (zero-touch: new products don't need SDK changes).
 */
export type ProductId =
  | 'enclii'
  | 'tezca'
  | 'yantra4d'
  | 'dhanam'
  | 'karafiel'
  | 'forgesight'
  | (string & {});

/** Subscription tier levels */
export type SubscriptionTier = 'community' | 'essentials' | 'pro' | 'premium' | 'madfam';

/**
 * Plan slug for checkout and upgrade flows.
 * Format: bare tier ("pro"), product-prefixed ("{product}_{tier}"),
 * or with billing period ("{product}_{tier}_yearly").
 * Known values are provided for autocomplete; any valid format is accepted.
 */
export type PlanSlug =
  | 'essentials'
  | 'pro'
  | 'premium'
  | 'madfam'
  | 'essentials_yearly'
  | 'pro_yearly'
  | 'premium_yearly'
  | 'madfam_yearly'
  | `${string}_${'essentials' | 'pro' | 'premium' | 'madfam'}`
  | `${string}_${'essentials' | 'pro' | 'premium' | 'madfam'}_${'yearly' | 'monthly'}`
  | (string & {});

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
// Credit-based Usage Metering Types
// ────────────────────────────────────────────────

/** Result of recording a credit usage event */
export interface CreditUsageResult {
  recorded: boolean;
  creditsRemaining: number;
  overageCredits: number;
  tier: SubscriptionTier;
}

/** Credit balance for an org */
export interface CreditBalance {
  creditsIncluded: number;
  creditsUsed: number;
  creditsRemaining: number;
  overageCredits: number;
  overageRate: number | null;
  tier: SubscriptionTier;
  periodStart: string;
  periodEnd: string;
}

/** Single usage event in a breakdown */
export interface UsageEventEntry {
  service: string;
  operation: string;
  credits: number;
  createdAt: string;
}

/** Per-service breakdown in usage response */
export interface ServiceBreakdown {
  totalCredits: number;
  operations: Record<string, number>;
}

/** Full usage breakdown response */
export interface UsageBreakdown {
  totalCredits: number;
  events: UsageEventEntry[];
  breakdown: Record<string, ServiceBreakdown>;
}

// ────────────────────────────────────────────────
// Product Catalog Types
// ────────────────────────────────────────────────

/** A product in the MADFAM ecosystem catalog */
export interface CatalogProduct {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  websiteUrl: string | null;
  tiers: CatalogTier[];
  creditCosts: CatalogCreditCost[];
}

/** A pricing tier within a product */
export interface CatalogTier {
  tierSlug: string;
  dhanamTier: SubscriptionTier;
  displayName: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  /** Prices keyed by currency (e.g., "MXN", "USD") */
  prices: Record<string, CatalogPrice>;
  features: string[];
}

/** Monthly and yearly price in smallest currency unit (centavos/cents) */
export interface CatalogPrice {
  monthly: number | null;
  yearly: number | null;
}

/** Credit cost for a metered operation on a product */
export interface CatalogCreditCost {
  operation: string;
  credits: number;
  label: string | null;
}

/** Response from GET /billing/catalog */
export interface CatalogResponse {
  products: CatalogProduct[];
  updatedAt: string;
}

// ────────────────────────────────────────────────
// Cancellation Pipeline Types
// ────────────────────────────────────────────────

/** Cancellation intent reasons */
export type CancellationReason =
  | 'too_expensive'
  | 'missing_features'
  | 'switched_service'
  | 'unused'
  | 'technical_issues'
  | 'other';

/** Save offer types returned by cancel-intent endpoint */
export type SaveOfferType = 'discount' | 'pause' | 'roadmap' | 'support' | 'loss_aversion';

/** Save offer returned during the cancellation flow */
export interface SaveOffer {
  type: SaveOfferType;
  intentId: string;
  discountPercent?: number;
  discountMonths?: number;
  suggestedPauseMonths?: number[];
  message?: string;
  features?: string[];
  supportUrl?: string;
}

/** Response from POST /billing/cancel-intent */
export interface CancelIntentResponse {
  intentId: string;
  saveOffer: SaveOffer;
}

/** Extended subscription status with pause and cancellation fields */
export interface SubscriptionStatusExtended extends SubscriptionStatus {
  isPaused: boolean;
  pausedUntil: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
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

// ────────────────────────────────────────────────
// Referral Reward Types (funnel types moved to PhyndCRM)
// ────────────────────────────────────────────────

/** A reward earned through referrals */
export interface ReferralReward {
  id: string;
  rewardType: 'subscription_extension' | 'credit_grant' | 'tier_discount';
  amount: number;
  description: string;
  applied: boolean;
  appliedAt: string | null;
  createdAt: string;
}

/** Ambassador profile with tier and lifetime metrics */
export interface AmbassadorProfile {
  tier: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
  totalReferrals: number;
  totalConversions: number;
  lifetimeCreditsEarned: number;
  lifetimeMonthsEarned: number;
  discountPercent: number;
  publicProfile: boolean;
  displayName: string | null;
}
