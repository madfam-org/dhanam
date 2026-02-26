// Client
export { DhanamClient } from './client';

// Errors
export { DhanamApiError, DhanamAuthError } from './errors';

// Webhook utilities
export { parseWebhookPayload, verifyWebhookSignature } from './webhook';

// Types (re-export everything)
export type {
  BillingEvent,
  BillingHistory,
  BillingProvider,
  CheckoutOptions,
  CheckoutResult,
  DhanamClientConfig,
  DhanamWebhookData,
  DhanamWebhookPayload,
  PlanSlug,
  PortalResult,
  SubscriptionStatus,
  SubscriptionTier,
  UpgradeOptions,
  UsageBucket,
  UsageMetricType,
  UsageMetrics,
} from './types';

// Enum (value export — consumers need runtime access)
export { DhanamWebhookEventType } from './types';
