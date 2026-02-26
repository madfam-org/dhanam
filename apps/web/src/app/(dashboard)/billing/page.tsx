'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dhanam/ui';
import { Button } from '@dhanam/ui';
import { Badge } from '@dhanam/ui';
import { Separator } from '@dhanam/ui';
import {
  CreditCard,
  ExternalLink,
  Loader2,
  Crown,
  Zap,
  Calendar,
  Receipt,
} from 'lucide-react';
import { billingApi, SubscriptionStatus, BillingEvent } from '@/lib/api/billing';
import { UsageOverview } from '@/components/billing/UsageIndicator';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useState } from 'react';
import { useTranslation } from '@dhanam/shared';

const TIER_CONFIG = {
  community: {
    label: 'Community',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    description: 'Free tier with basic features',
  },
  essentials: {
    label: 'Essentials',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    description: 'AI categorization, bank sync, 10 simulations/day',
  },
  pro: {
    label: 'Pro',
    color: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
    description: 'Unlimited usage on all features',
  },
} as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

export default function BillingPage() {
  const { t } = useTranslation('dashboard');
  const router = useRouter();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billingApi.getStatus(),
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['billing-history'],
    queryFn: () => billingApi.getHistory(10),
  });

  const tier = status?.tier || 'community';
  const tierConfig = TIER_CONFIG[tier];

  const handleManageSubscription = async () => {
    setIsOpeningPortal(true);
    try {
      const { portalUrl } = await billingApi.createPortalSession();
      window.location.href = portalUrl;
    } catch {
      toast.error('Unable to open subscription management. Please try again.');
      setIsOpeningPortal(false);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and view usage.</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>{tierConfig.description}</CardDescription>
              </div>
            </div>
            <Badge className={tierConfig.color}>{tierConfig.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isActive && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Started: {formatDate(status.startedAt)}</span>
              </div>
              {status.expiresAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Renews: {formatDate(status.expiresAt)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {tier === 'community' && (
              <Button
                onClick={() => router.push('/billing/upgrade')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Zap className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Button>
            )}
            {tier === 'essentials' && (
              <Button
                onClick={() => router.push('/billing/upgrade')}
                variant="outline"
              >
                <Zap className="mr-2 h-4 w-4" />
                Upgrade to Pro
              </Button>
            )}
            {(tier === 'essentials' || tier === 'pro') && (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isOpeningPortal}
              >
                {isOpeningPortal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Manage Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Daily Usage</CardTitle>
          </div>
          <CardDescription>Your feature usage resets daily at midnight UTC.</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageOverview />
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle>Billing History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No billing events yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((event: BillingEvent) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between py-2 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        event.status === 'succeeded'
                          ? 'default'
                          : event.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                      className="text-xs"
                    >
                      {event.type.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {event.amount > 0 ? formatCurrency(event.amount, event.currency) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
