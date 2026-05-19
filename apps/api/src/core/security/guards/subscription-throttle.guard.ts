import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

import { SubscriptionTier } from '@db';

/**
 * Per-user subscription-tier rate limiting guard.
 *
 * Tracks requests by authenticated userId (falls back to IP for
 * unauthenticated requests) and enforces tier-based limits over
 * a 15-minute sliding window.
 *
 * Tier limits (per 15 min):
 *   community  - 1 000
 *   essentials - 1 500
 *   pro        - 2 000
 *   premium    - 3 000
 *
 * SOC 2 Control: Prevents abuse from any single user regardless of
 * subscription tier while granting higher-paying customers proportionally
 * more headroom.
 */
@Injectable()
export class SubscriptionThrottleGuard extends ThrottlerGuard {
  private readonly logger = new Logger(SubscriptionThrottleGuard.name);

  /** 15 minutes in milliseconds */
  static readonly WINDOW_MS = 15 * 60 * 1000;

  /** Requests allowed per 15-minute window, keyed by subscription tier. */
  static readonly TIER_LIMITS: Record<SubscriptionTier, number> = {
    community: 1_000,
    essentials: 1_500,
    pro: 2_000,
    premium: 3_000,
  };

  /**
   * Track by authenticated userId when available, otherwise by IP.
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    if (userId) {
      return `user:${userId}`;
    }
    return req.ip || 'unknown';
  }

  /**
   * Override handleRequest to inject tier-based limit and a fixed 15-min TTL.
   */
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest();
    const tier: SubscriptionTier | undefined = req.user?.subscriptionTier;
    const resolvedTier = tier && tier in SubscriptionThrottleGuard.TIER_LIMITS ? tier : 'community';

    const limit = SubscriptionThrottleGuard.TIER_LIMITS[resolvedTier];

    this.logger.debug(
      `Rate limit check: tier=${resolvedTier}, limit=${limit}, user=${req.user?.id ?? 'anonymous'}`
    );

    return super.handleRequest({
      ...requestProps,
      limit,
      ttl: SubscriptionThrottleGuard.WINDOW_MS,
    });
  }
}
