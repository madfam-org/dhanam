'use client';

import { Alert, AlertDescription, Button } from '@dhanam/ui';
import { useQuery } from '@tanstack/react-query';
import { Clock, CreditCard, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { billingApi } from '~/lib/api/billing';

export function TrialBanner() {
  const router = useRouter();
  const { data: status } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billingApi.getStatus(),
    refetchInterval: 60_000, // Refresh every minute
  });

  if (!status?.isInTrial) return null;

  const trialEndsAt = status.trialEndsAt ? new Date(status.trialEndsAt) : null;
  const now = new Date();
  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <Alert className="border-blue-600/20 bg-blue-600/5">
      <Clock className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between w-full">
        <span className="text-sm">
          <Sparkles className="inline h-3.5 w-3.5 mr-1 text-blue-600" />
          Your <span className="font-semibold capitalize">{status.tier}</span> trial ends in{' '}
          <span className="font-semibold">
            {daysLeft} day{daysLeft !== 1 ? 's' : ''}
          </span>
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/billing/upgrade')}>
            <CreditCard className="h-3.5 w-3.5 mr-1" />
            Subscribe Now
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
