'use client';

import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@dhanam/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ArrowLeft, Zap, Crown, Sparkles, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAnalytics } from '~/hooks/useAnalytics';
import { billingApi } from '~/lib/api/billing';

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default function UpgradePage() {
  const router = useRouter();
  const analytics = useAnalytics();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: status } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billingApi.getStatus(),
  });

  const { data: pricing } = useQuery({
    queryKey: ['billing-pricing'],
    queryFn: () => {
      const geoCookie = document.cookie
        .split('; ')
        .find((c) => c.startsWith('dhanam_geo='))
        ?.split('=')[1];
      return billingApi.getPricing(geoCookie || undefined);
    },
  });

  const currentTier = status?.tier || 'community';
  const tierRank: Record<string, number> = { community: 0, essentials: 1, pro: 2, premium: 3 };

  const tiers = pricing?.tiers || [
    {
      id: 'essentials',
      name: 'Essentials',
      monthlyPrice: 4.99,
      promoPrice: null,
      currency: 'USD',
      features: [
        '20 ESG calculations/day',
        '10 Monte Carlo simulations/day',
        '2 financial spaces',
        'Bank sync (Belvo + Bitso)',
        'AI transaction categorization',
        '500 MB storage',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      monthlyPrice: 11.99,
      promoPrice: null,
      currency: 'USD',
      features: [
        'Unlimited simulations',
        '5 financial spaces',
        'All bank & exchange connections',
        'Estate planning & Life Beat',
        'Household views',
        'Collectibles valuation',
        '5 GB storage',
      ],
    },
    {
      id: 'premium',
      name: 'Premium',
      monthlyPrice: 19.99,
      promoPrice: null,
      currency: 'USD',
      features: [
        'Everything in Pro',
        '10 financial spaces',
        '50,000 Monte Carlo iterations',
        '24 stress scenarios',
        '25 GB storage',
        'Dedicated priority support',
      ],
    },
  ];

  const handleSubscribe = async (plan: string) => {
    if (plan === currentTier) return;

    setLoadingPlan(plan);
    const tier = tiers.find((t) => t.id === plan);
    analytics.trackUpgradeInitiated('premium', tier?.monthlyPrice || 0);

    try {
      const { checkoutUrl } = await billingApi.upgradeToPremium({
        plan,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/billing/upgrade`,
      });
      window.location.href = checkoutUrl;
    } catch {
      toast.error('Unable to start checkout. Please try again.');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-5xl">
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

      {/* Trial/Promo status banner */}
      {status?.isInTrial && (
        <div className="rounded-lg bg-blue-600/10 border border-blue-600/20 p-4 text-center">
          <p className="text-sm font-medium">
            <Sparkles className="inline h-4 w-4 mr-1 text-blue-600" />
            You&apos;re on a free trial of{' '}
            <span className="font-bold capitalize">{currentTier}</span>.
            {status.trialEndsAt && (
              <> Trial ends {new Date(status.trialEndsAt).toLocaleDateString()}.</>
            )}
          </p>
        </div>
      )}

      {status?.isInPromo && (
        <div className="rounded-lg bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-primary/20 p-4 text-center">
          <p className="text-sm font-medium">
            <Sparkles className="inline h-4 w-4 mr-1 text-primary" />
            You&apos;re enjoying promo pricing.
            {status.promoEndsAt && (
              <> Promo ends {new Date(status.promoEndsAt).toLocaleDateString()}.</>
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const isCurrent = tier.id === currentTier;
          const isDowngrade = (tierRank[currentTier] ?? 0) > (tierRank[tier.id] ?? 0);
          const isPro = tier.id === 'pro';
          const isPremium = tier.id === 'premium';

          return (
            <Card
              key={tier.id}
              className={`relative ${
                isPro ? 'border-primary shadow-lg' : ''
              } ${isPremium ? 'border-amber-500 shadow-lg' : ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {isPro && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              {isPremium && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <Star className="h-3 w-3 mr-1" />
                    Premium
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
                <div className="flex items-baseline gap-1 pt-2">
                  {tier.promoPrice !== null && !isCurrent ? (
                    <>
                      <span className="text-3xl font-bold">
                        {formatPrice(tier.promoPrice, tier.currency)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                      <span className="text-muted-foreground text-sm ml-2 line-through">
                        {formatPrice(tier.monthlyPrice, tier.currency)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">
                        {formatPrice(tier.monthlyPrice, tier.currency)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </>
                  )}
                </div>
                {tier.promoPrice !== null && !isCurrent && pricing?.trial && (
                  <p className="text-xs text-muted-foreground">
                    Promo for {pricing.trial.promoMonths} months, then{' '}
                    {formatPrice(tier.monthlyPrice, tier.currency)}/mo
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
                    isPro && !isCurrent && !isDowngrade
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                      : ''
                  } ${
                    isPremium && !isCurrent && !isDowngrade
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'
                      : ''
                  }`}
                  variant={isCurrent || isDowngrade ? 'outline' : 'default'}
                  disabled={isCurrent || isDowngrade || loadingPlan !== null}
                  onClick={() => handleSubscribe(tier.id)}
                >
                  {loadingPlan === tier.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    !isCurrent && !isDowngrade && <Zap className="mr-2 h-4 w-4" />
                  )}
                  {isCurrent
                    ? 'Current Plan'
                    : isDowngrade
                      ? 'Downgrade via Portal'
                      : `Subscribe to ${tier.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Cancel anytime. Regional pricing applied automatically.
      </p>
    </div>
  );
}
