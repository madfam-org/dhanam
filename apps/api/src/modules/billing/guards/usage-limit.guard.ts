import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UsageMetricType } from '@db';

import { BillingService } from '../billing.service';
import { USAGE_METRIC_KEY } from '../decorators';
import { UsageLimitExceededException } from '../exceptions';

@Injectable()
export class UsageLimitGuard implements CanActivate {
  private readonly logger = new Logger(UsageLimitGuard.name);

  constructor(
    private reflector: Reflector,
    private billingService: BillingService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metricType = this.reflector.get<UsageMetricType>(USAGE_METRIC_KEY, context.getHandler());

    // No usage tracking - allow access
    if (!metricType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('UsageLimitGuard: No user found in request');
      return true; // Let other guards handle authentication
    }

    // Platform admins bypass all usage limits
    if (user.isAdmin) {
      return true;
    }

    // Check if user has exceeded usage limit
    const hasAccess = await this.billingService.checkUsageLimit(user.id, metricType);

    if (!hasAccess) {
      this.logger.log(
        `User ${user.id} exceeded ${metricType} usage limit (tier: ${user.subscriptionTier})`
      );

      const limits = this.billingService.getUsageLimits();
      const limit = limits[user.subscriptionTier][metricType];

      throw new UsageLimitExceededException(
        `Daily limit of ${limit} ${(metricType as string).replace(/_/g, ' ')} reached. Upgrade to Pro for unlimited access.`
      );
    }

    return true;
  }
}
