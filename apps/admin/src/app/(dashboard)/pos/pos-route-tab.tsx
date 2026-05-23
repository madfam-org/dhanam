'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@dhanam/ui';
import { Loader2, Route } from 'lucide-react';
import type { FormEvent } from 'react';

import type { RoutePreviewResult } from '@/lib/api/admin';

import { EmptyState, ErrorBanner, Field, PLANS, PRODUCTS, SelectField } from './pos-shared';

export type RouteFormState = {
  userId: string;
  product: string;
  plan: string;
  countryCode: string;
};

export function PosRouteTab({
  routeForm,
  setRouteForm,
  routePreview,
  routeError,
  routeLoading,
  onPreview,
}: {
  routeForm: RouteFormState;
  setRouteForm: React.Dispatch<React.SetStateAction<RouteFormState>>;
  routePreview: RoutePreviewResult | null;
  routeError: string | null;
  routeLoading: boolean;
  onPreview: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="space-y-6 pt-4">
      {routeError && <ErrorBanner message={routeError} />}

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
            </div>
          ) : (
            <EmptyState message="Run a preview to see routing decisions" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
