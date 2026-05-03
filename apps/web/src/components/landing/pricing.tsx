'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { CheckCircle, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    // Try to detect country from cookie or default to US
    const geoCookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('dhanam_geo='))
      ?.split('=')[1];

    billingApi
      .getPricing(geoCookie || undefined)
      .then(setPricing)
      .catch(() => {
        // Fallback: use static defaults
      });
  }, []);

  // Fallback static pricing if API not available
  const tiers = pricing?.tiers || [
    {
      id: 'essentials',
      name: 'Essentials',
      monthlyPrice: 4.99,
      promoPrice: null,
      currency: 'USD',
      features: [],
    },
    {
      id: 'pro',
      name: 'Pro',
      monthlyPrice: 11.99,
      promoPrice: null,
      currency: 'USD',
      features: [],
    },
    {
      id: 'premium',
      name: 'Premium',
      monthlyPrice: 19.99,
      promoPrice: null,
      currency: 'USD',
      features: [],
    },
  ];
  const trial = pricing?.trial || { daysWithoutCC: 3, daysWithCC: 21, promoMonths: 3 };
  const hasPromo = tiers.some((t) => t.promoPrice !== null);

  return (
    <section className="container mx-auto px-6 py-16" id="pricing">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t('pricing.title')}</h2>
          <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
          {hasPromo && (
            <div className="mt-4 inline-flex items-center gap-2 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-primary/20 rounded-full px-4 py-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>
                Start free for {trial.daysWithoutCC} days — then promo pricing for{' '}
                {trial.promoMonths} months
              </span>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const isPro = tier.id === 'pro';
            const isPremium = tier.id === 'premium';

            return (
              <div
                key={tier.id}
                className={`rounded-lg bg-card p-6 relative ${
                  isPro ? 'border-2 border-primary' : 'border'
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {t('pricing.mostPopular')}
                  </div>
                )}
                {isPremium && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Premium
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
                        <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                        {isBold ? <strong>{feature}</strong> : feature}
                      </li>
                    );
                  })}
                </ul>
                <Button
                  className={`w-full ${isPro ? 'bg-gradient-to-r from-blue-600 to-purple-600' : ''} ${isPremium ? 'bg-gradient-to-r from-amber-500 to-orange-500' : ''}`}
                  variant="default"
                  onClick={() => onSignUpClick(tier.id)}
                >
                  Start {trial.daysWithoutCC}-Day Free Trial
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  {t('pricing.cancelAnytime')}
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('pricing.selfHosted').split('Community')[0]}
          <a
            href="https://github.com/aldoruizluna/Dhanam"
            className="text-primary hover:underline font-medium"
          >
            Community edition
          </a>
        </p>
      </div>
    </section>
  );
}
