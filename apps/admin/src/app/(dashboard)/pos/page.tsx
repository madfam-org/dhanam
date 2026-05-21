'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@dhanam/ui';
import { Copy, CreditCard, ExternalLink, Loader2, Search } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import { adminApi, type PosCheckoutResult, type PosCheckoutStatus } from '@/lib/api/admin';

const PRODUCTS = ['dhanam', 'karafiel', 'tezca', 'enclii', 'janua', 'routecraft'];
const PLANS = ['essentials', 'essentials_yearly', 'pro', 'pro_yearly', 'premium', 'premium_yearly'];

const initialForm = {
  userId: '',
  product: 'dhanam',
  plan: 'pro',
  orgId: '',
  countryCode: 'MX',
  successUrl: '',
  cancelUrl: '',
};

export default function PosPage() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<PosCheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusSessionId, setStatusSessionId] = useState('');
  const [statusResult, setStatusResult] = useState<PosCheckoutStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const routeLabel = useMemo(() => {
    if (!result) return 'Pending';
    return result.provider.replace(/_/g, ' ');
  }, [result]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCopied(false);
    setResult(null);

    if (!form.userId.trim()) {
      setError('User ID is required.');
      return;
    }

    setLoading(true);
    try {
      const checkout = await adminApi.createPosCheckout({
        userId: form.userId.trim(),
        product: form.product,
        plan: form.plan,
        orgId: form.orgId.trim() || undefined,
        countryCode: form.countryCode.trim().toUpperCase() || undefined,
        successUrl: form.successUrl.trim() || undefined,
        cancelUrl: form.cancelUrl.trim() || undefined,
      });
      setResult(checkout);
      setStatusSessionId(checkout.sessionId || '');
      setStatusResult(null);
    } catch (_err) {
      setError('Unable to create POS checkout link.');
    } finally {
      setLoading(false);
    }
  };

  const copyCheckoutUrl = async () => {
    if (!result?.checkoutUrl) return;
    await navigator.clipboard.writeText(result.checkoutUrl);
    setCopied(true);
  };

  const loadStatus = async () => {
    const sessionId = statusSessionId.trim();
    if (!sessionId) {
      setStatusError('Session ID is required.');
      return;
    }

    setStatusLoading(true);
    setStatusError(null);
    try {
      setStatusResult(await adminApi.getPosCheckoutStatus(sessionId));
    } catch (_err) {
      setStatusError('Unable to load checkout status.');
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MADFAM POS</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Create operator checkout links for ecosystem billing
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {routeLabel}
        </Badge>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checkout Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <div className="md:col-span-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={form.userId}
                  onChange={(event) => updateField('userId', event.target.value)}
                  placeholder="user_..."
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="product">Product</Label>
                <select
                  id="product"
                  value={form.product}
                  onChange={(event) => updateField('product', event.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PRODUCTS.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="plan">Plan</Label>
                <select
                  id="plan"
                  value={form.plan}
                  onChange={(event) => updateField('plan', event.target.value)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PLANS.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="countryCode">Country</Label>
                <Input
                  id="countryCode"
                  value={form.countryCode}
                  onChange={(event) => updateField('countryCode', event.target.value)}
                  maxLength={2}
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="orgId">Organization ID</Label>
                <Input
                  id="orgId"
                  value={form.orgId}
                  onChange={(event) => updateField('orgId', event.target.value)}
                  placeholder="org_..."
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="successUrl">Success URL</Label>
                <Input
                  id="successUrl"
                  value={form.successUrl}
                  onChange={(event) => updateField('successUrl', event.target.value)}
                  placeholder="https://app.dhan.am/billing/success"
                  autoComplete="off"
                />
              </div>

              <div>
                <Label htmlFor="cancelUrl">Cancel URL</Label>
                <Input
                  id="cancelUrl"
                  value={form.cancelUrl}
                  onChange={(event) => updateField('cancelUrl', event.target.value)}
                  placeholder="https://app.dhan.am/billing"
                  autoComplete="off"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={loading} className="gap-2">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Create checkout
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checkout Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result ? (
              <>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Provider</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {result.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Product</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {result.product}/{result.plan}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 dark:text-gray-400">Session ID</span>
                    <span className="truncate font-medium text-gray-900 dark:text-white">
                      {result.sessionId || 'Unavailable'}
                    </span>
                  </div>
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 break-all">
                  {result.checkoutUrl}
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={copyCheckoutUrl}
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button type="button" asChild className="gap-2">
                    <a href={result.checkoutUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                No checkout link created
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Checkout Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {statusError}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Label htmlFor="statusSessionId">Session ID</Label>
              <Input
                id="statusSessionId"
                value={statusSessionId}
                onChange={(event) => setStatusSessionId(event.target.value)}
                placeholder="cs_..."
                autoComplete="off"
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={loadStatus} disabled={statusLoading} className="gap-2">
                {statusLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Load status
              </Button>
            </div>
          </div>

          {statusResult ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-md border border-gray-200 p-4 text-sm dark:border-gray-700">
                <div className="grid gap-3">
                  {[
                    ['Provider', statusResult.provider],
                    ['Checkout', statusResult.status || 'unknown'],
                    ['Payment', statusResult.paymentStatus || 'unknown'],
                    ['Product', statusResult.product || 'unknown'],
                    ['Plan', statusResult.plan || 'unknown'],
                    ['User', statusResult.userId || 'unknown'],
                    ['Subscription', statusResult.subscriptionId || 'none'],
                    ['Amount', formatAmount(statusResult.amountTotal, statusResult.currency)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-gray-500 dark:text-gray-400">{label}</span>
                      <span className="truncate font-medium text-gray-900 dark:text-white">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
                <div className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
                  Recent Billing Events
                </div>
                {statusResult.billingEvents.length > 0 ? (
                  <div className="space-y-3">
                    {statusResult.billingEvents.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 text-sm last:border-0 last:pb-0 dark:border-gray-800"
                      >
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {event.type}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(event.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{event.status}</Badge>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {event.amount} {event.currency}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    No billing events found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No checkout status loaded
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatAmount(amountMinor: number | null, currency: string | null) {
  if (amountMinor === null || !currency) {
    return 'unknown';
  }

  return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}
