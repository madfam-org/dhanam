import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SubscriptionTier } from '@db';

import { TIER_KEY } from '../decorators';
import { PaymentRequiredException, SubscriptionExpiredException } from '../exceptions';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<SubscriptionTier>(TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No tier requirement - allow access
    if (!requiredTier) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('SubscriptionGuard: No user found in request');
      throw new PaymentRequiredException('Authentication required');
    }

    // Platform admins bypass all subscription checks
    if (user.isAdmin) {
      return true;
    }

    // Check if user has required tier
    if (!this.hasRequiredTier(user.subscriptionTier, requiredTier)) {
      this.logger.log(
        `User ${user.id} attempted to access ${requiredTier} feature with ${user.subscriptionTier} tier`
      );
      throw new PaymentRequiredException(
        `This feature requires a ${requiredTier} subscription. Upgrade at /billing/upgrade`
      );
    }

    // Check subscription expiration (for paid tier users)
    if (user.subscriptionTier !== 'community' && user.subscriptionExpiresAt) {
      const now = new Date();
      const expiresAt = new Date(user.subscriptionExpiresAt);

      if (expiresAt < now) {
        this.logger.log(`User ${user.id} subscription expired at ${expiresAt}`);
        throw new SubscriptionExpiredException(
          'Your subscription has expired. Renew at /billing/renew'
        );
      }
    }

    return true;
  }

  /**
   * Check if user's tier meets the required tier
   * Tier hierarchy: community < essentials < pro < premium
   */
  private hasRequiredTier(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
    const tierHierarchy: Record<SubscriptionTier, number> = {
      community: 0,
      essentials: 1,
      pro: 2,
      premium: 3,
    };

    return (tierHierarchy[userTier] ?? 0) >= (tierHierarchy[requiredTier] ?? 0);
  }
}
