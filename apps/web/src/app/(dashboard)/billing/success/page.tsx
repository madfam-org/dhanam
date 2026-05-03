'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@dhanam/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useAnalytics } from '@/hooks/useAnalytics';

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  useEffect(() => {
    // Invalidate billing-related queries to refresh subscription status
    queryClient.invalidateQueries({ queryKey: ['billing-status'] });
    queryClient.invalidateQueries({ queryKey: ['billing-history'] });
    queryClient.invalidateQueries({ queryKey: ['user'] });

    const price = parseFloat(searchParams.get('amount') || '0') || 4.99;
    analytics.trackUpgradeCompleted('premium', price, 'stripe');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: Intentionally run once on mount to fire analytics and invalidate caches
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[500px] p-6">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome to Premium!</CardTitle>
          <CardDescription>
            Your subscription is now active. All premium features have been unlocked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You now have access to unlimited simulations, goal tracking, scenario analysis, and all
            advanced features. Thank you for supporting Dhanam!
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => router.push('/billing')}>
              View Billing Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
