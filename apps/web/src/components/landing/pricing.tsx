'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { CheckCircle, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CheckoutPaymentRecommendations } from '~/components/billing/CheckoutPaymentRecommendations';
import { billingApi, PricingResponse } from '~/lib/api/billing';

interface PricingProps {
  onSignUpClick: (plan?: string) => void;
}

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

export function Pricing({ onSignUpClick }: PricingProps) {
  const { t } = useTranslation('landing');
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [geoCountry, setGeoCountry] = useState<string | undefined>();

  useEffect(() => {
    // Try to detect country from cookie or default to MX (LATAM-first; MXN is the
    // canonical anchoring currency per
    // internal-devops/decisions/2026-04-25-tulana-ecosystem-pricing.md).
    const geoCookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('dhanam_geo='))
      ?.split('=')[1];

    setGeoCountry(geoCookie?.toUpperCase() || 'MX');

    billingApi
      .getPricing(geoCookie || undefined)
      .then(setPricing)
      .catch(() => {
        // Fallback: use the static Tulana v0.1 tiers below
      });
  }, []);

  // Fallback static pricing — anchored to the Tulana v0.1 recommended Consumer
  // tiers (MXN/mo): Free $0 / Copilot Pro 199 / Family Plus 499. Source of
  // truth: internal-devops/decisions/2026-04-25-tulana-ecosystem-pricing.md.
  // Confidence is low and pricing is subject to validation with real users.
  const tiers = pricing?.tiers || [
    {
      id: 'free',
      name: 'Free',
      monthlyPrice: 0,
      promoPrice: null,
      currency: 'MXN',
      features: [],
    },
    {
      id: 'copilot_pro',
      name: 'Copilot Pro',
      monthlyPrice: 199,
      promoPrice: null,
      currency: 'MXN',
      features: [],
    },
    {
      id: 'family_plus',
      name: 'Family Plus',
      monthlyPrice: 499,
      promoPrice: null,
      currency: 'MXN',
      features: [],
    },
  ];
  const trial = pricing?.trial || { daysWithoutCC: 14, daysWithCC: 30, promoMonths: 3 };
  const hasPromo = tiers.some((t) => t.promoPrice !== null);
  const recommendedTier = tiers.find((t) => t.id === 'copilot_pro' || t.id === 'pro') ?? tiers[1];
  const recommendationPlan = recommendedTier?.id === 'copilot_pro' ? 'copilot_pro' : 'pro';
  const recommendationAmountMinor = recommendedTier
    ? Math.round((recommendedTier.promoPrice ?? recommendedTier.monthlyPrice) * 100)
    : undefined;

  return (
    <section className="container mx-auto px-6 py-16" id="pricing">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t('pricing.title')}</h2>
          <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
          {hasPromo && (
            <div className="mt-4 inline-flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-full px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                Start free for {trial.daysWithoutCC} days — then promo pricing for{' '}
                {trial.promoMonths} months
              </span>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground max-w-xl mx-auto">
            Indicative pricing in MXN per month, anchored to the Tulana v0.1 ecosystem
            recommendation and subject to validation with real users.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            // Highlight the recommended consumer tier (Copilot Pro). The legacy
            // 'pro' id stays supported for back-compat with API responses.
            const isPro = tier.id === 'copilot_pro' || tier.id === 'pro';
            // 'family_plus' is the highest consumer tier; 'premium' kept for back-compat.
            const isPremium = tier.id === 'family_plus' || tier.id === 'premium';
            const isFree = tier.monthlyPrice === 0 || tier.id === 'free';

            return (
              <div
                key={tier.id}
                className={`group rounded-lg bg-card p-6 relative transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg ${
                  isPro
                    ? 'border-2 border-primary shadow-md ring-1 ring-primary/15'
                    : 'border hover:border-primary/40'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                    {t('pricing.mostPopular')}
                  </div>
                )}
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-warning text-warning-foreground px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                    <Star className="h-3 w-3" />
                    {t('pricing.bestValue')}
                  </div>
                )}
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <div className="mb-4">
                  {tier.promoPrice !== null ? (
                    <>
                      <p className="text-3xl font-bold">
                        {formatPrice(tier.promoPrice, tier.currency)}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      <p className="text-sm text-muted-foreground line-through">
                        {formatPrice(tier.monthlyPrice, tier.currency)}/mo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Promo for {trial.promoMonths} months, then{' '}
                        {formatPrice(tier.monthlyPrice, tier.currency)}/mo
                      </p>
                    </>
                  ) : (
                    <p className="text-3xl font-bold">
                      {formatPrice(tier.monthlyPrice, tier.currency)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                  )}
                </div>
                <ul className="space-y-2 text-sm mb-6">
                  {tier.features.map((feature, index) => {
                    const isBold = index === 0;
                    return (
                      <li key={index} className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        {isBold ? <strong>{feature}</strong> : feature}
                      </li>
                    );
                  })}
                </ul>
                <Button
                  className="w-full transition-transform duration-200 active:scale-[0.98]"
                  variant={isPro ? 'default' : 'outline'}
                  onClick={() => onSignUpClick(tier.id)}
                >
                  {isFree ? 'Get Started' : `Start ${trial.daysWithoutCC}-Day Trial`}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  {t('pricing.cancelAnytime')}
                </p>
              </div>
            );
          })}
        </div>

        <div className="max-w-2xl mx-auto mt-8">
          <CheckoutPaymentRecommendations
            countryCode={geoCountry}
            plan={recommendationPlan}
            amountMinor={recommendationAmountMinor}
            currency={recommendedTier?.currency ?? pricing?.currency ?? 'MXN'}
            variant="compact"
          />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('pricing.selfHosted').split('Community')[0]}
          <a
            href="https://github.com/madfam-org/dhanam"
            className="text-primary hover:underline font-medium"
            target="_blank"
            rel="noopener noreferrer"
          >
            Community edition
          </a>
        </p>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Building on the MADFAM ecosystem and need billing-as-a-service?{' '}
          <a href="/for-platforms" className="text-primary hover:underline font-medium">
            See Dhanam for platforms.
          </a>
        </p>
      </div>
    </section>
  );
}
