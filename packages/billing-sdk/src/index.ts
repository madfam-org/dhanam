// Client
export { DhanamClient } from './client';

// Usage metering client
export { DhanamUsageClient } from './usage';
export type { UsageClientConfig } from './usage';

// Referral client (rewards-only; funnel tracking moved to PhyndCRM)
export { DhanamReferralClient } from './referral';
export type { ReferralClientConfig } from './referral';

// Errors
export { DhanamApiError, DhanamAuthError } from './errors';

// Webhook utilities
export { parseWebhookPayload, verifyWebhookSignature } from './webhook';

// Types (re-export everything)
export type {
  AmbassadorProfile,
  BillingEvent,
  BillingHistory,
  BillingProvider,
  CheckoutOptions,
  CheckoutResult,
  CreditBalance,
  CreditUsageResult,
  DhanamClientConfig,
  DhanamWebhookData,
  DhanamWebhookPayload,
  PlanSlug,
  PortalResult,
  ReferralReward,
  ServiceBreakdown,
  SubscriptionStatus,
  SubscriptionTier,
  UpgradeOptions,
  UsageBreakdown,
  UsageBucket,
  UsageEventEntry,
  UsageMetricType,
  UsageMetrics,
} from './types';

// Enum (value export — consumers need runtime access)
export { DhanamWebhookEventType } from './types';
