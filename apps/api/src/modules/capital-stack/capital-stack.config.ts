/** Platform config keys for owner–operator capital stack (RFC-6). */
export const CAPITAL_STACK_CONFIG_KEYS = {
  autoSendThreshold: 'capital_stack.auto_send_threshold',
  manualReviewThreshold: 'capital_stack.manual_review_threshold',
  flowTypesRequiringReview: 'capital_stack.flow_types_requiring_review',
} as const;

export type CapitalStackConfigKey =
  (typeof CAPITAL_STACK_CONFIG_KEYS)[keyof typeof CAPITAL_STACK_CONFIG_KEYS];

export const CAPITAL_STACK_CONFIG_PREFIX = 'capital_stack.';

export const DEFAULT_CAPITAL_STACK_THRESHOLDS = {
  autoSend: 0.85,
  manualReview: 0.5,
} as const;
