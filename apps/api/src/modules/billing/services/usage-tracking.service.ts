import { Injectable, Logger } from '@nestjs/common';

import { UsageMetricType } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

/**
 * Usage Tracking Service
 *
 * Manages daily usage metering and tier-based feature limits.
 * Extracted from BillingService to isolate the usage-tracking concern.
 *
 * ## Responsibilities
 * - Daily usage counter management (record, check, query)
 * - Per-tier usage limit definitions
 * - Per-tier feature limit definitions (spaces, providers, storage, etc.)
 *
 * ## Usage Limits
 * Counters reset daily at midnight UTC. Each metric type has a per-tier cap:
 * - Community: Unlimited (self-hosted, BYOK)
 * - Essentials: Moderate caps (20 ESG, 10 MC, 5 goals, 3 scenarios)
 * - Pro / Premium: Unlimited
 *
 * @see UsageLimitGuard - enforces limits before handler execution
 * @see UsageTrackingInterceptor - records usage after successful requests
 * @see FeatureGateGuard - checks boolean feature flags from tierLimits
 */
@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);

  // ─── Usage limits per tier ───────────────────────────────────────────
  private readonly usageLimits = {
    community: {
      esg_calculation: Infinity,
      monte_carlo_simulation: Infinity,
      goal_probability: Infinity,
      scenario_analysis: Infinity,
      portfolio_rebalance: Infinity,
      api_request: Infinity,
    },
    essentials: {
      esg_calculation: 20,
      monte_carlo_simulation: 10,
      goal_probability: 5,
      scenario_analysis: 3,
      portfolio_rebalance: 0,
      api_request: 5_000,
    },
    pro: {
      esg_calculation: Infinity,
      monte_carlo_simulation: Infinity,
      goal_probability: Infinity,
      scenario_analysis: Infinity,
      portfolio_rebalance: Infinity,
      api_request: Infinity,
    },
    premium: {
      esg_calculation: Infinity,
      monte_carlo_simulation: Infinity,
      goal_probability: Infinity,
      scenario_analysis: Infinity,
      portfolio_rebalance: Infinity,
      api_request: Infinity,
    },
  };

  // ─── Feature / resource limits per tier ──────────────────────────────
  readonly tierLimits = {
    community: {
      maxSpaces: Infinity,
      maxProviderConnections: Infinity, // self-hosted: BYOK (bring your own API keys)
      allowedProviders: 'all' as const,
      mlCategorization: true, // self-hosted users run their own inference
      monteCarloMaxIterations: 10_000,
      monteCarloMaxScenarios: 12,
      storageBytes: Infinity, // self-hosted users provide their own storage
      lifeBeat: true,
      householdViews: true,
      collectiblesValuation: true,
    },
    essentials: {
      maxSpaces: 2,
      maxProviderConnections: 3, // 2 Belvo + 1 Bitso
      allowedProviders: ['belvo', 'bitso'],
      mlCategorization: true,
      monteCarloMaxIterations: 5_000,
      monteCarloMaxScenarios: 6,
      storageBytes: 500 * 1024 * 1024, // 500 MB
      lifeBeat: false,
      householdViews: false,
      collectiblesValuation: false,
    },
    pro: {
      maxSpaces: 5,
      maxProviderConnections: Infinity,
      allowedProviders: 'all' as const,
      mlCategorization: true,
      monteCarloMaxIterations: 10_000,
      monteCarloMaxScenarios: 12,
      storageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
      lifeBeat: true,
      householdViews: true,
      collectiblesValuation: true,
    },
    premium: {
      maxSpaces: 10,
      maxProviderConnections: Infinity,
      allowedProviders: 'all' as const,
      mlCategorization: true,
      monteCarloMaxIterations: 50_000,
      monteCarloMaxScenarios: 24,
      storageBytes: 25 * 1024 * 1024 * 1024, // 25 GB
      lifeBeat: true,
      householdViews: true,
      collectiblesValuation: true,
      prioritySupport: true,
    },
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Record usage metric for a user.
   *
   * Increments the daily usage counter for the specified metric type.
   * Counters reset daily at midnight UTC.
   */
  async recordUsage(userId: string, metricType: UsageMetricType): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.usageMetric.upsert({
      where: {
        userId_metricType_date: {
          userId,
          metricType,
          date: today,
        },
      },
      create: {
        userId,
        metricType,
        date: today,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
    });
  }

  /**
   * Check if user can perform an operation based on usage limits.
   *
   * Returns true if the user has not exceeded their daily limit for the metric.
   * Pro / Premium users always return true (unlimited usage).
   */
  async checkUsageLimit(userId: string, metricType: UsageMetricType): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, isAdmin: true },
    });

    if (!user) {
      return false;
    }

    // Platform admins have unlimited usage
    if (user.isAdmin) {
      return true;
    }

    // Pro and premium users have unlimited usage
    if (user.subscriptionTier === 'pro' || user.subscriptionTier === 'premium') {
      return true;
    }

    const tier = (user.subscriptionTier as keyof typeof this.usageLimits) || 'community';
    const limit = this.usageLimits[tier]?.[metricType] ?? this.usageLimits.community[metricType];

    // Infinity limit means unlimited for this tier
    if (limit === Infinity) {
      return true;
    }

    // 0 limit means feature is not available for this tier
    if (limit === 0) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const usage = await this.prisma.usageMetric.findUnique({
      where: {
        userId_metricType_date: {
          userId,
          metricType,
          date: today,
        },
      },
    });

    const currentCount = usage?.count || 0;
    return currentCount < limit;
  }

  /**
   * Get usage limits configuration (all tiers).
   */
  getUsageLimits() {
    return this.usageLimits;
  }

  /**
   * Get feature limits for a specific tier.
   */
  getTierLimits(tier: string) {
    return this.tierLimits[tier as keyof typeof this.tierLimits] || this.tierLimits.community;
  }

  /**
   * Get a user's current usage metrics for today.
   *
   * Returns usage counts and limits for all metric types.
   * Limit of -1 indicates unlimited (Pro / Premium tier).
   */
  async getUserUsage(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    const metrics = await this.prisma.usageMetric.findMany({
      where: {
        userId,
        date: today,
      },
    });

    const usageByType: Record<string, { used: number; limit: number }> = {};

    for (const metricType of Object.keys(this.usageLimits.community) as UsageMetricType[]) {
      const metric = metrics.find((m) => m.metricType === metricType);
      const tier = (user?.subscriptionTier as keyof typeof this.usageLimits) || 'community';
      const limit = this.usageLimits[tier]?.[metricType] ?? this.usageLimits.community[metricType];

      usageByType[metricType] = {
        used: metric?.count || 0,
        limit: limit === Infinity ? -1 : limit, // -1 represents unlimited
      };
    }

    return {
      date: today,
      tier: user?.subscriptionTier || 'community',
      usage: usageByType,
    };
  }
}
