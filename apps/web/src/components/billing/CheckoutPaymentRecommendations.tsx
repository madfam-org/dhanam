'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { billingApi, type CheckoutRouteRecommendation } from '~/lib/api/billing';
import { useShowcaseEmbed } from '~/lib/showcase/embed-mode';

function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function CheckoutPaymentRecommendations({
  countryCode,
  plan = 'pro',
  amountMinor,
  currency,
  variant = 'default',
  selectable = false,
  selectedPaymentMethod,
  onSelectPaymentMethod,
  deferUntilVisible = false,
}: {
  countryCode?: string;
  plan?: string;
  amountMinor?: number;
  currency?: string;
  variant?: 'default' | 'compact';
  selectable?: boolean;
  selectedPaymentMethod?: string;
  onSelectPaymentMethod?: (paymentMethod: string) => void;
  /** Delay the API call until the block scrolls near the viewport (landing pages). */
  deferUntilVisible?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(!deferUntilVisible);
  const isShowcaseEmbed = useShowcaseEmbed();

  useEffect(() => {
    if (!deferUntilVisible || visible) {
      return undefined;
    }

    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px', threshold: 0.01 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [deferUntilVisible, visible]);

  const { data, isLoading } = useQuery({
    queryKey: ['checkout-route-recommendation', countryCode, plan, amountMinor, currency],
    queryFn: () =>
      billingApi.getCheckoutRouteRecommendation({
        country: countryCode || 'MX',
        plan,
        amountMinor,
        currency,
      }),
    enabled: Boolean(countryCode) && visible && !isShowcaseEmbed,
    staleTime: 60_000,
  });

  if (!countryCode || isShowcaseEmbed) {
    return null;
  }

  if (!visible || isLoading || !data?.feeOptimization) {
    return <div ref={containerRef} className="min-h-px" aria-hidden />;
  }

  const { feeOptimization } = data;
  const top = feeOptimization.instrumentSuggestions.find((s) => s.recommended);
  const cardBaseline = feeOptimization.instrumentSuggestions.find(
    (s) => s.paymentMethod === 'card'
  );

  if (!top) {
    return null;
  }

  const activeMethod = selectedPaymentMethod ?? top.paymentMethod;
  const isCompact = variant === 'compact';

  const containerClass = isCompact
    ? 'rounded-md border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/30'
    : 'rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/40';

  const summary = (
    <>
      <p
        className={`flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100 ${
          isCompact ? 'text-xs' : 'text-sm'
        }`}
      >
        <Sparkles className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0`} />
        Lowest-cost checkout for your region
      </p>
      <p
        className={`${isCompact ? 'mt-1 text-xs' : 'mt-2 text-sm'} text-emerald-800 dark:text-emerald-200`}
      >
        We recommend <strong>{top.label}</strong> via{' '}
        <span className="font-mono text-xs">{data.provider.replace(/_/g, ' ')}</span>
        {feeOptimization.savingsVsCardMinor && cardBaseline ? (
          <>
            {' '}
            — saves about{' '}
            <strong>{formatMinor(feeOptimization.savingsVsCardMinor, data.currency)}</strong> in
            processing fees vs card
          </>
        ) : null}
        .
      </p>
    </>
  );

  const instrumentList =
    feeOptimization.instrumentSuggestions.length > 1 ? (
      selectable ? (
        <div className={`${isCompact ? 'mt-2' : 'mt-3'} space-y-2`}>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
            Choose payment method
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {feeOptimization.instrumentSuggestions.slice(0, 4).map((row) => {
              const isSelected = row.paymentMethod === activeMethod;
              return (
                <button
                  key={`${row.provider}-${row.paymentMethod}`}
                  type="button"
                  onClick={() => onSelectPaymentMethod?.(row.paymentMethod)}
                  className={`flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-100/80 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-50'
                      : 'border-emerald-200/80 bg-white/60 text-emerald-800 hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200'
                  }`}
                >
                  <span className="flex items-start gap-1.5">
                    {isSelected ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-emerald-400/60" />
                    )}
                    <span>
                      <span className="block font-medium">{row.label}</span>
                      {row.recommended ? (
                        <span className="text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          Recommended
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMinor(row.totalEconomicCostMinor, data.currency)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ul
          className={`${isCompact ? 'mt-2 space-y-0.5 text-[11px]' : 'mt-3 space-y-1 text-xs'} text-emerald-700 dark:text-emerald-300`}
        >
          {feeOptimization.instrumentSuggestions.slice(0, isCompact ? 3 : 4).map((row) => (
            <li key={`${row.provider}-${row.paymentMethod}`} className="flex justify-between gap-4">
              <span>{row.label}</span>
              <span>{formatMinor(row.totalEconomicCostMinor, data.currency)} est. fees</span>
            </li>
          ))}
        </ul>
      )
    ) : null;

  return (
    <div ref={containerRef} className={containerClass}>
      {summary}
      {instrumentList}
    </div>
  );
}

export type { CheckoutRouteRecommendation };
