'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@dhanam/ui';
import { Button } from '@dhanam/ui';
import { Badge } from '@dhanam/ui';
import { CheckCircle2, Loader2, ArrowLeft, Zap, Crown, Sparkles } from 'lucide-react';
import { billingApi } from '@/lib/api/billing';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAnalytics } from '@/hooks/useAnalytics';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  introPrice?: string;
  priceNote: string;
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  plan: string;
}

const INTRO_PRICE = '$0.99';
const INTRO_MONTHS = 3;

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'essentials',
    name: 'Essentials',
    price: '$4.99',
    introPrice: INTRO_PRICE,
    priceNote: '/month',
    description: 'AI categorization and bank sync for growing finances',
    features: [
      '20 ESG calculations/day',
      '10 Monte Carlo simulations/day',
      '5 goal probability analyses/day',
      '3 scenario analyses/day',
      '2 financial spaces',
      'Bank sync (Belvo + Bitso)',
      'AI transaction categorization',
      '5,000 API requests/day',
      '500 MB storage',
    ],
    cta: 'Subscribe to Essentials',
    popular: true,
    plan: 'essentials',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$11.99',
    introPrice: INTRO_PRICE,
    priceNote: '/month',
    description: 'Unlimited access for serious wealth management',
    features: [
      'Unlimited ESG calculations',
      'Unlimited Monte Carlo simulations',
      'Unlimited goal probability',
      'Unlimited scenario analysis',
      'Portfolio rebalancing',
      '5 financial spaces',
      'All bank & exchange connections',
      'AI categorization + LifeBeat',
      'Household views',
      'Collectibles valuation',
      'Unlimited API requests',
      '5 GB storage',
      'Priority support',
    ],
    cta: 'Subscribe to Pro',
    plan: 'pro',
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const analytics = useAnalytics();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billingApi.getStatus(),
  });

  const currentTier = status?.tier || 'community';

  const handleSubscribe = async (plan: string) => {
    if (plan === currentTier) return;

    setLoadingPlan(plan);
    analytics.trackUpgradeInitiated('premium', plan === 'essentials' ? 4.99 : 11.99);

    try {
      const { checkoutUrl } = await billingApi.upgradeToPremium({
        plan,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/billing/upgrade`,
      });
      window.location.href = checkoutUrl;
    } catch (err) {
      toast.error('Unable to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/billing')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Connect your accounts and take control of your finances.
          </p>
        </div>
      </div>

      {/* Intro offer banner */}
      <div className="rounded-lg bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-primary/20 p-4 text-center">
        <p className="text-sm font-medium">
          <Sparkles className="inline h-4 w-4 mr-1 text-primary" />
          Launch offer: <span className="font-bold">{INTRO_PRICE}/mo for your first {INTRO_MONTHS} months</span> on any plan
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PRICING_TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier;
          const isDowngrade = currentTier === 'pro' && tier.id === 'essentials';

          return (
            <Card
              key={tier.id}
              className={`relative ${
                tier.popular
                  ? 'border-primary shadow-lg'
                  : ''
              } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {tier.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="bg-background">
                    <Crown className="h-3 w-3 mr-1" />
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="pt-8">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="flex items-baseline gap-1 pt-2">
                  {tier.introPrice && !isCurrent ? (
                    <>
                      <span className="text-3xl font-bold">{tier.introPrice}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                      <span className="text-muted-foreground text-sm ml-2 line-through">{tier.price}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">{tier.price}</span>
                      <span className="text-muted-foreground text-sm">{tier.priceNote}</span>
                    </>
                  )}
                </div>
                {tier.introPrice && !isCurrent && (
                  <p className="text-xs text-muted-foreground">
                    {tier.introPrice}/mo for {INTRO_MONTHS} months, then {tier.price}/mo
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    tier.popular && !isCurrent && !isDowngrade
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                      : ''
                  }`}
                  variant={isCurrent || isDowngrade ? 'outline' : 'default'}
                  disabled={isCurrent || isDowngrade || loadingPlan !== null}
                  onClick={() => handleSubscribe(tier.plan)}
                >
                  {loadingPlan === tier.plan ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    !isCurrent && !isDowngrade && <Zap className="mr-2 h-4 w-4" />
                  )}
                  {isCurrent
                    ? 'Current Plan'
                    : isDowngrade
                      ? 'Downgrade via Portal'
                      : tier.cta}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Cancel anytime. Prices in USD. MXN pricing available at checkout for Mexican users.
      </p>
    </div>
  );
}
