'use client';

import { ReactNode } from 'react';

import { useAuth } from '~/lib/hooks/use-auth';

import { PremiumUpsell } from './PremiumUpsell';

type SubscriptionTier = 'community' | 'essentials' | 'pro' | 'premium';

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
  premium: 3,
};

/**
 * PremiumGate Component
 *
 * Conditionally renders children based on user's subscription status.
 * Tier hierarchy: community < essentials < pro < premium.
 * Use `requiredTier="pro"` for pro-only features (e.g., LifeBeat, household views).
 * Use `requiredTier="premium"` for premium-only features.
 *
 * Usage:
 * <PremiumGate feature="Monte Carlo Simulations">
 *   <SimulationComponent />
 * </PremiumGate>
 *
 * <PremiumGate feature="LifeBeat" requiredTier="pro">
 *   <LifeBeatComponent />
 * </PremiumGate>
 *
 * <PremiumGate feature="Advanced Analytics" requiredTier="premium">
 *   <AdvancedAnalyticsComponent />
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
  const isDemoUser = user?.email?.endsWith('@dhanam.demo');
  const hasAccess = isDemoUser || user?.isAdmin || TIER_RANK[userTier] >= TIER_RANK[requiredTier];

  if (!hasAccess) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <PremiumUpsell feature={feature} context="feature_locked" />
    );
  }

  return <>{children}</>;
}
