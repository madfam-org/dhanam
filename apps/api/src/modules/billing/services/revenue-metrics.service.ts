import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '@core/prisma/prisma.service';
import { Prisma } from '@db';

/**
 * Tier pricing map (USD monthly).
 * Must stay in sync with the SubscriptionTier enum comments in schema.prisma.
 */
const TIER_PRICE_USD: Record<string, number> = {
  essentials: 4.99,
  pro: 11.99,
  premium: 19.99,
};

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  churnRate: number;
  totalActiveSubscribers: number;
  subscribersByTier: Record<string, number>;
  averageLTV: number;
  calculatedAt: string;
}

@Injectable()
export class RevenueMetricsService {
  private readonly logger = new Logger(RevenueMetricsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate and return all revenue metrics in a single call.
   */
  async getRevenueMetrics(): Promise<RevenueMetrics> {
    const [mrr, subscribersByTier, churnRate, averageLTV] = await Promise.all([
      this.getMRR(),
      this.getSubscribersByTier(),
      this.getChurnRate(),
      this.getAverageLTV(),
    ]);

    const totalActiveSubscribers = Object.values(subscribersByTier).reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      mrr,
      arr: mrr * 12,
      churnRate,
      totalActiveSubscribers,
      subscribersByTier,
      averageLTV,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Monthly Recurring Revenue: sum of monthly price for every user
   * with an active paid subscription (tier != community, not expired).
   */
  async getMRR(): Promise<number> {
    const now = new Date();

    const users = await this.prisma.user.findMany({
      where: {
        subscriptionTier: { notIn: ['community'] },
        subscriptionExpiresAt: { gt: now },
        deletedAt: null,
      },
      select: { subscriptionTier: true },
    });

    let mrr = 0;
    for (const user of users) {
      const price = TIER_PRICE_USD[user.subscriptionTier] ?? 0;
      mrr += price;
    }

    return Math.round(mrr * 100) / 100;
  }

  /**
   * Count of active subscribers grouped by tier.
   * Excludes community tier and expired subscriptions.
   */
  async getSubscribersByTier(): Promise<Record<string, number>> {
    const now = new Date();

    const groups = await this.prisma.user.groupBy({
      by: ['subscriptionTier'],
      where: {
        subscriptionTier: { notIn: ['community'] },
        subscriptionExpiresAt: { gt: now },
        deletedAt: null,
      },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const group of groups) {
      result[group.subscriptionTier] = group._count.id;
    }

    return result;
  }

  /**
   * Churn rate over a rolling period.
   *
   * Numerator: distinct users with a subscription_cancelled BillingEvent
   *   in [now - periodDays, now].
   * Denominator: total active subscribers at the start of the period
   *   (currently active + those who churned during the window).
   *
   * Uses BillingEvent instead of User.cancelledAt because the generated
   * Prisma client may not yet expose that column on UserWhereInput.
   *
   * Returns a value between 0 and 1 (e.g. 0.05 = 5% churn).
   */
  async getChurnRate(periodDays: number = 30): Promise<number> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const [cancelledInPeriod, currentActiveCount] = await Promise.all([
      // Distinct users who had a cancellation event in the window
      this.prisma.billingEvent.groupBy({
        by: ['userId'],
        where: {
          type: 'subscription_cancelled',
          createdAt: { gte: periodStart, lte: now },
        },
      }),
      this.prisma.user.count({
        where: {
          subscriptionTier: { notIn: ['community'] },
          subscriptionExpiresAt: { gt: now },
          deletedAt: null,
        },
      }),
    ]);

    const cancelledCount = cancelledInPeriod.length;

    // Subscribers at period start = currently active + those who churned
    const subscribersAtStart = currentActiveCount + cancelledCount;

    if (subscribersAtStart === 0) {
      return 0;
    }

    const rate = cancelledCount / subscribersAtStart;
    return Math.round(rate * 10000) / 10000; // 4 decimal places
  }

  /**
   * Lifetime value for a single user based on actual payment events.
   */
  async getLTVByUser(userId: string): Promise<{ totalRevenue: number; monthsActive: number }> {
    const aggregate = await this.prisma.billingEvent.aggregate({
      where: {
        userId,
        type: 'payment_succeeded',
        status: 'succeeded',
      },
      _sum: { amount: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    const totalRevenue = aggregate._sum.amount
      ? new Prisma.Decimal(aggregate._sum.amount).toNumber()
      : 0;

    let monthsActive = 0;
    if (aggregate._min.createdAt && aggregate._max.createdAt) {
      const diffMs = aggregate._max.createdAt.getTime() - aggregate._min.createdAt.getTime();
      monthsActive = Math.max(1, Math.ceil(diffMs / (30 * 24 * 60 * 60 * 1000)));
    }

    return { totalRevenue, monthsActive };
  }

  /**
   * Cohort-level LTV: average lifetime revenue of users who signed up
   * in a given calendar month (format "YYYY-MM", e.g. "2026-04").
   */
  async getLTVByCohort(
    cohortMonth: string
  ): Promise<{ cohort: string; avgLTV: number; userCount: number }> {
    // Parse cohort boundaries
    const [year, month] = cohortMonth.split('-').map(Number);
    const cohortStart = new Date(year, month - 1, 1);
    const cohortEnd = new Date(year, month, 1);

    // Find users created in the cohort month
    const cohortUsers = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: cohortStart, lt: cohortEnd },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (cohortUsers.length === 0) {
      return { cohort: cohortMonth, avgLTV: 0, userCount: 0 };
    }

    const userIds = cohortUsers.map((u) => u.id);

    // Aggregate all payment_succeeded events for those users
    const aggregate = await this.prisma.billingEvent.aggregate({
      where: {
        userId: { in: userIds },
        type: 'payment_succeeded',
        status: 'succeeded',
      },
      _sum: { amount: true },
    });

    const totalRevenue = aggregate._sum.amount
      ? new Prisma.Decimal(aggregate._sum.amount).toNumber()
      : 0;

    const avgLTV = Math.round((totalRevenue / cohortUsers.length) * 100) / 100;

    return {
      cohort: cohortMonth,
      avgLTV,
      userCount: cohortUsers.length,
    };
  }

  /**
   * Average LTV across all users who have ever paid.
   */
  private async getAverageLTV(): Promise<number> {
    const result = await this.prisma.billingEvent.groupBy({
      by: ['userId'],
      where: {
        type: 'payment_succeeded',
        status: 'succeeded',
      },
      _sum: { amount: true },
    });

    if (result.length === 0) {
      return 0;
    }

    let totalRevenue = 0;
    for (const row of result) {
      totalRevenue += row._sum.amount ? new Prisma.Decimal(row._sum.amount).toNumber() : 0;
    }

    return Math.round((totalRevenue / result.length) * 100) / 100;
  }
}
