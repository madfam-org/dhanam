'use client';

import { ReactNode } from 'react';
import { useAuth } from '~/lib/hooks/use-auth';
import { PremiumUpsell } from './PremiumUpsell';

type SubscriptionTier = 'community' | 'essentials' | 'pro';

interface PremiumGateProps {
  children: ReactNode;
  feature?: string;
  fallback?: ReactNode;
  /** Minimum tier required. Defaults to 'essentials' (any paid tier). */
  requiredTier?: SubscriptionTier;
}

const TIER_RANK: Record<SubscriptionTier, number> = {
  community: 0,
  essentials: 1,
  pro: 2,
};

/**
 * PremiumGate Component
 *
 * Conditionally renders children based on user's subscription status.
 * Both 'essentials' and 'pro' are recognized as paid tiers.
 * Use `requiredTier="pro"` for pro-only features (e.g., LifeBeat, household views).
 *
 * Usage:
 * <PremiumGate feature="Monte Carlo Simulations">
 *   <SimulationComponent />
 * </PremiumGate>
 *
 * <PremiumGate feature="LifeBeat" requiredTier="pro">
 *   <LifeBeatComponent />
 * </PremiumGate>
 */
export function PremiumGate({
  children,
  feature,
  fallback,
  requiredTier = 'essentials',
}: PremiumGateProps) {
  const { user } = useAuth();
  const userTier = (user?.subscriptionTier as SubscriptionTier) || 'community';
  const hasAccess = TIER_RANK[userTier] >= TIER_RANK[requiredTier];

  if (!hasAccess) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <PremiumUpsell feature={feature} context="feature_locked" />
    );
  }

  return <>{children}</>;
}
