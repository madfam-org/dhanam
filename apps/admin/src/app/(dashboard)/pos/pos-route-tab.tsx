'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@dhanam/ui';
import { Loader2, Route, ShieldOff, ShieldPlus } from 'lucide-react';
import type { FormEvent } from 'react';

import type { RoutePreviewResult } from '@/lib/api/admin';

import { EmptyState, ErrorBanner, Field, PLANS, PRODUCTS, SelectField } from './pos-shared';

export type RouteFormState = {
  userId: string;
  product: string;
  plan: string;
  countryCode: string;
};

const OVERRIDE_PROVIDERS = ['stripe_mx', 'paddle', 'legacy_stripe', 'conekta'] as const;

export function PosRouteTab({
  routeForm,
  setRouteForm,
  routePreview,
  routeError,
  routeLoading,
  onPreview,
  overrideProvider,
  setOverrideProvider,
  overrideReason,
  setOverrideReason,
  overrideTtlHours,
  setOverrideTtlHours,
  overrideLoading,
  overrideError,
  overrideMessage,
  onSetOverride,
  onClearOverride,
}: {
  routeForm: RouteFormState;
  setRouteForm: React.Dispatch<React.SetStateAction<RouteFormState>>;
  routePreview: RoutePreviewResult | null;
  routeError: string | null;
  routeLoading: boolean;
  onPreview: (event: FormEvent<HTMLFormElement>) => void;
  overrideProvider: string;
  setOverrideProvider: (value: string) => void;
  overrideReason: string;
  setOverrideReason: (value: string) => void;
  overrideTtlHours: string;
  setOverrideTtlHours: (value: string) => void;
  overrideLoading: boolean;
  overrideError: string | null;
  overrideMessage: string | null;
  onSetOverride: (event: FormEvent<HTMLFormElement>) => void;
  onClearOverride: () => void;
}) {
  return (
    <div className="space-y-6 pt-4">
      {routeError && <ErrorBanner message={routeError} />}
      {overrideError && <ErrorBanner message={overrideError} />}
      {overrideMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {overrideMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Routing Matrix Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onPreview}>
            <Field label="User ID" id="route-userId" className="md:col-span-2">
              <Input
                id="route-userId"
                value={routeForm.userId}
                onChange={(e) => setRouteForm((c) => ({ ...c, userId: e.target.value }))}
                placeholder="user_..."
                autoComplete="off"
              />
            </Field>
            <SelectField
              label="Product"
              id="route-product"
              value={routeForm.product}
              options={PRODUCTS}
              onChange={(value) => setRouteForm((c) => ({ ...c, product: value }))}
            />
            <SelectField
              label="Plan"
              id="route-plan"
              value={routeForm.plan}
              options={PLANS}
              onChange={(value) => setRouteForm((c) => ({ ...c, plan: value }))}
            />
            <Field label="Country" id="route-country">
              <Input
                id="route-country"
                value={routeForm.countryCode}
                onChange={(e) => setRouteForm((c) => ({ ...c, countryCode: e.target.value }))}
                maxLength={2}
                autoComplete="off"
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={routeLoading} className="gap-2">
                {routeLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Route className="h-4 w-4" />
                )}
                Preview route
              </Button>
            </div>
          </form>

          {routePreview ? (
            <div className="mt-6 grid gap-3 rounded-md border border-gray-200 p-4 text-sm dark:border-gray-700 md:grid-cols-2">
              {[
                ['Provider', routePreview.provider],
                ['Reason', routePreview.routeReason],
                ['Country', routePreview.countryCode],
                ['Currency', routePreview.currency],
                ['Catalog plan', routePreview.catalogPlanId],
                ['Janua enabled', String(routePreview.januaEnabled)],
                ['Unified routing', String(routePreview.unifiedRoutingEnabled)],
                ['Hybrid available', String(routePreview.hybridRouterAvailable)],
                ['Legacy Stripe', String(routePreview.legacyStripeAvailable)],
                ['Price resolvable', String(routePreview.priceIdResolvable)],
                ['Payment methods', routePreview.paymentMethods.join(', ') || 'none'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="truncate font-medium text-gray-900 dark:text-white">
                    {value}
                  </span>
                </div>
              ))}
              {routePreview.feeOptimization ? (
                <>
                  <div className="md:col-span-2 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Fee-optimal instruments
                    </p>
                    <ul className="space-y-1">
                      {routePreview.feeOptimization.instrumentSuggestions.slice(0, 4).map((row) => (
                        <li
                          key={`${row.provider}-${row.paymentMethod}`}
                          className="flex justify-between gap-4"
                        >
                          <span>
                            {row.label}
                            {row.recommended ? ' ★' : ''}
                          </span>
                          <span>{row.totalEconomicCostMinor} minor est.</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <EmptyState message="Run a preview to see routing decisions" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Operator Route Override</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Stored overrides apply to checkout routing for the selected user and product. All
            changes are audit-logged.
          </p>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSetOverride}>
            <SelectField
              label="Forced provider"
              id="override-provider"
              value={overrideProvider}
              options={[...OVERRIDE_PROVIDERS]}
              onChange={setOverrideProvider}
            />
            <Field label="TTL (hours)" id="override-ttl">
              <Input
                id="override-ttl"
                type="number"
                min={1}
                max={168}
                value={overrideTtlHours}
                onChange={(e) => setOverrideTtlHours(e.target.value)}
              />
            </Field>
            <Field label="Audit reason" id="override-reason" className="md:col-span-2">
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why is this override required?"
                autoComplete="off"
              />
            </Field>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" disabled={overrideLoading} className="gap-2">
                {overrideLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldPlus className="h-4 w-4" />
                )}
                Set override
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={overrideLoading}
                className="gap-2"
                onClick={onClearOverride}
              >
                <ShieldOff className="h-4 w-4" />
                Clear override
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
