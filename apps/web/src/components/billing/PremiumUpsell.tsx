'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAnalytics } from '@/hooks/useAnalytics';

interface PremiumUpsellProps {
  feature?: string;
  context?: 'limit_reached' | 'feature_locked' | 'generic';
}

export function PremiumUpsell({ feature, context = 'generic' }: PremiumUpsellProps) {
  const router = useRouter();
  const analytics = useAnalytics();

  // Track when upsell is viewed
  useEffect(() => {
    analytics.trackPremiumUpsellViewed(context, feature);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, feature]);

  const handleUpgrade = () => {
    // Track click
    analytics.trackPremiumUpsellClicked(context, feature);
    analytics.trackUpgradeInitiated('premium', 4.99);

    router.push('/billing/upgrade');
  };

  const getTitle = () => {
    switch (context) {
      case 'limit_reached':
        return 'Daily Limit Reached';
      case 'feature_locked':
        return `Unlock ${feature || 'Premium Features'}`;
      default:
        return 'Upgrade Your Plan';
    }
  };

  const getDescription = () => {
    switch (context) {
      case 'limit_reached':
        return `You've used your daily free simulations. Upgrade for more access.`;
      case 'feature_locked':
        return `${feature || 'This feature'} is available on paid plans.`;
      default:
        return 'Get more features and higher limits to unlock your financial potential.';
    }
  };

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>{getTitle()}</CardTitle>
        </div>
        <CardDescription>{getDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Essentials */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Essentials</h4>
              <Badge variant="secondary">Popular</Badge>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">$4.99</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                10 simulations/day
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                AI categorization
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                Bank sync (Belvo + Bitso)
              </li>
            </ul>
          </div>

          {/* Pro */}
          <div className="border rounded-lg p-4 space-y-3 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-primary/30">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Pro</h4>
              <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">Best Value</Badge>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">$11.99</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                Unlimited everything
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                All connections
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                Priority support
              </li>
            </ul>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleUpgrade}
          size="lg"
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Zap className="mr-2 h-5 w-5" />
          View All Plans
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Cancel anytime.
        </p>
      </CardContent>
    </Card>
  );
}
