'use client';

import { Gauge, TrendingUp, Target, LineChart, Briefcase, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { billingApi, UsageMetrics } from '~/lib/api/billing';
import { useAuth } from '~/lib/hooks/use-auth';

type MetricType =
  | 'esg_calculation'
  | 'monte_carlo_simulation'
  | 'goal_probability'
  | 'scenario_analysis'
  | 'portfolio_rebalance'
  | 'api_request';

const METRIC_CONFIG: Record<
  MetricType,
  { label: string; shortLabel: string; icon: React.ReactNode }
> = {
  esg_calculation: {
    label: 'ESG Calculations',
    shortLabel: 'ESG',
    icon: <TrendingUp className="h-3 w-3" />,
  },
  monte_carlo_simulation: {
    label: 'Monte Carlo Simulations',
    shortLabel: 'Simulations',
    icon: <LineChart className="h-3 w-3" />,
  },
  goal_probability: {
    label: 'Goal Probability',
    shortLabel: 'Goals',
    icon: <Target className="h-3 w-3" />,
  },
  scenario_analysis: {
    label: 'Scenario Analysis',
    shortLabel: 'Scenarios',
    icon: <Activity className="h-3 w-3" />,
  },
  portfolio_rebalance: {
    label: 'Portfolio Rebalancing',
    shortLabel: 'Rebalance',
    icon: <Briefcase className="h-3 w-3" />,
  },
  api_request: {
    label: 'API Requests',
    shortLabel: 'API',
    icon: <Gauge className="h-3 w-3" />,
  },
};

interface UsageIndicatorProps {
  /** Which metric type to display */
  metricType: MetricType;
  /** Show as compact badge or full display */
  variant?: 'badge' | 'full';
  /** Custom className */
  className?: string;
}

/**
 * UsageIndicator Component
 *
 * Displays remaining usage for free-tier users.
 * Shows nothing for premium users (unlimited usage).
 *
 * Usage:
 * <UsageIndicator metricType="esg_calculation" />
 * <UsageIndicator metricType="monte_carlo_simulation" variant="full" />
 */
export function UsageIndicator({
  metricType,
  variant = 'badge',
  className = '',
}: UsageIndicatorProps) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Don't show for premium users
  const isPremium = user?.subscriptionTier === 'pro';

  useEffect(() => {
    if (isPremium || !user) {
      setLoading(false);
      return;
    }

    const fetchUsage = async () => {
      try {
        const data = await billingApi.getUsage();
        setUsage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage');
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [isPremium, user]);

  // Don't render for premium users or if no user
  if (isPremium || !user) {
    return null;
  }

  if (loading) {
    return null;
  }

  if (error || !usage) {
    return null;
  }

  const metric = usage.usage[metricType];
  const config = METRIC_CONFIG[metricType];

  // -1 indicates unlimited
  if (metric.limit === -1) {
    return null;
  }

  // 0 means feature not available for this tier
  if (metric.limit === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className={`text-xs ${className}`}>
              {config.icon}
              <span className="ml-1">Premium only</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label} requires Premium subscription</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const remaining = metric.limit - metric.used;
  const percentUsed = (metric.used / metric.limit) * 100;

  // Determine color based on remaining usage
  const getStatusColor = () => {
    if (remaining === 0) return 'destructive';
    if (percentUsed >= 80) return 'secondary'; // warning state
    return 'outline';
  };

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant={getStatusColor()} className={`text-xs ${className}`}>
              {config.icon}
              <span className="ml-1">
                {remaining}/{metric.limit}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {remaining} {config.label.toLowerCase()} remaining today
            </p>
            {remaining === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade to Premium for unlimited access
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      {config.icon}
      <span className="text-muted-foreground">{config.shortLabel}:</span>
      <span className={remaining === 0 ? 'text-destructive font-medium' : ''}>
        {remaining}/{metric.limit} remaining
      </span>
      {remaining === 0 && <span className="text-xs text-muted-foreground">(limit reached)</span>}
    </div>
  );
}

/**
 * UsageOverview Component
 *
 * Displays all usage metrics in a compact summary.
 * Useful for billing pages or dashboards.
 */
export function UsageOverview({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const isPremium = user?.subscriptionTier === 'pro';

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchUsage = async () => {
      try {
        const data = await billingApi.getUsage();
        setUsage(data);
      } catch {
        // Silent fail for overview
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [user]);

  if (loading || !usage) {
    return null;
  }

  if (isPremium) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        <Badge variant="secondary" className="mr-2">
          Premium
        </Badge>
        Unlimited usage on all features
      </div>
    );
  }

  const metricTypes: MetricType[] = [
    'esg_calculation',
    'monte_carlo_simulation',
    'goal_probability',
    'scenario_analysis',
  ];

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {metricTypes.map((metricType) => (
        <UsageIndicator key={metricType} metricType={metricType} variant="badge" />
      ))}
    </div>
  );
}
