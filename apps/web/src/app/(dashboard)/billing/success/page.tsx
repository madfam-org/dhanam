'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dhanam/ui';
import { Button } from '@dhanam/ui';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function BillingSuccessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  useEffect(() => {
    // Invalidate billing-related queries to refresh subscription status
    queryClient.invalidateQueries({ queryKey: ['billing-status'] });
    queryClient.invalidateQueries({ queryKey: ['billing-history'] });
    queryClient.invalidateQueries({ queryKey: ['user'] });

    analytics.trackUpgradeCompleted('premium', 0, 'stripe');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            You now have access to unlimited simulations, goal tracking, scenario analysis,
            and all advanced features. Thank you for supporting Dhanam!
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
