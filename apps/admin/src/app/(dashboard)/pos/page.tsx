'use client';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@dhanam/ui';
import { CreditCard, Loader2, RefreshCw, Search, Undo2, Wallet } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  adminApi,
  type PosChargeResult,
  type PosCheckoutResult,
  type PosCheckoutStatus,
  type PosRefundResult,
  type PosTimelineEntry,
  type ReconciliationSummary,
} from '@/lib/api/admin';

import { CheckoutResultPanel, CheckoutStatusPanel } from './pos-checkout-panels';
import { PosFeeScheduleTab } from './pos-fee-schedule-tab';
import { PosRouteTab } from './pos-route-tab';
import {
  PRODUCTS,
  PLANS,
  Field,
  SelectField,
  ErrorBanner,
  EmptyState,
  ResultList,
} from './pos-shared';
import { usePosFeeSchedule } from './use-pos-fee-schedule';
import { usePosRoute } from './use-pos-route';

const initialCheckoutForm = {
  userId: '',
  product: 'dhanam',
  plan: 'pro',
  orgId: '',
  countryCode: 'MX',
};

const initialChargeForm = {
  userId: '',
  amountMinor: '19900',
  currency: 'MXN',
  description: 'MADFAM POS charge',
  countryCode: 'MX',
  paymentMethod: 'card' as 'card' | 'oxxo' | 'customer_balance',
  correlationId: '',
};

const initialRefundForm = {
  paymentIntentId: '',
  amountMinor: '',
  reason: '',
  correlationId: '',
};

export default function PosPage() {
  const [activeTab, setActiveTab] = useState('checkout');

  const [checkoutForm, setCheckoutForm] = useState(initialCheckoutForm);
  const [checkoutResult, setCheckoutResult] = useState<PosCheckoutResult | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [statusSessionId, setStatusSessionId] = useState('');
  const [statusResult, setStatusResult] = useState<PosCheckoutStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const {
    routeForm,
    setRouteForm,
    routePreview,
    routeError,
    routeLoading,
    overrideProvider,
    setOverrideProvider,
    overrideReason,
    setOverrideReason,
    overrideTtlHours,
    setOverrideTtlHours,
    overrideLoading,
    overrideError,
    overrideMessage,
    previewRoute,
    setRouteOverride,
    clearRouteOverride,
  } = usePosRoute();

  const {
    feeSchedule,
    feeScheduleJson,
    setFeeScheduleJson,
    feeScheduleError,
    feeScheduleLoading,
    feeScheduleSaving,
    feeScheduleMessage,
    loadFeeSchedule,
    saveFeeSchedule,
    clearFeeScheduleOverride,
  } = usePosFeeSchedule(activeTab);

  const [chargeForm, setChargeForm] = useState(initialChargeForm);
  const [chargeResult, setChargeResult] = useState<PosChargeResult | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [chargeLoading, setChargeLoading] = useState(false);

  const [refundForm, setRefundForm] = useState(initialRefundForm);
  const [refundResult, setRefundResult] = useState<PosRefundResult | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

  const [timelineCorrelationId, setTimelineCorrelationId] = useState('');
  const [timeline, setTimeline] = useState<PosTimelineEntry[]>([]);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [reconciliationError, setReconciliationError] = useState<string | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  const routeLabel = useMemo(() => {
    if (checkoutResult) return checkoutResult.provider.replace(/_/g, ' ');
    if (routePreview) return routePreview.provider.replace(/_/g, ' ');
    return 'Pending';
  }, [checkoutResult, routePreview]);

  const loadReconciliation = useCallback(async () => {
    setReconciliationLoading(true);
    setReconciliationError(null);
    try {
      setReconciliation(await adminApi.getBillingReconciliation());
    } catch {
      setReconciliationError('Unable to load reconciliation summary.');
    } finally {
      setReconciliationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ops') {
      void loadReconciliation();
    }
  }, [activeTab, loadReconciliation]);

  const submitCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCheckoutError(null);
    setCopied(false);
    setCheckoutResult(null);

    if (!checkoutForm.userId.trim()) {
      setCheckoutError('User ID is required.');
      return;
    }

    setCheckoutLoading(true);
    try {
      const checkout = await adminApi.createPosCheckout({
        userId: checkoutForm.userId.trim(),
        product: checkoutForm.product,
        plan: checkoutForm.plan,
        orgId: checkoutForm.orgId.trim() || undefined,
        countryCode: checkoutForm.countryCode.trim().toUpperCase() || undefined,
      });
      setCheckoutResult(checkout);
      setStatusSessionId(checkout.sessionId || '');
      setStatusResult(null);
    } catch {
      setCheckoutError('Unable to create POS checkout link.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const copyCheckoutUrl = async () => {
    if (!checkoutResult?.checkoutUrl) return;
    await navigator.clipboard.writeText(checkoutResult.checkoutUrl);
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
    } catch {
      setStatusError('Unable to load checkout status.');
    } finally {
      setStatusLoading(false);
    }
  };

  const submitCharge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setChargeError(null);
    setChargeResult(null);

    const amountMinor = Number.parseInt(chargeForm.amountMinor, 10);
    if (!chargeForm.userId.trim() || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      setChargeError('User ID and a positive amount are required.');
      return;
    }

    setChargeLoading(true);
    try {
      const result = await adminApi.createPosCharge({
        userId: chargeForm.userId.trim(),
        amountMinor,
        currency: chargeForm.currency.trim().toUpperCase(),
        description: chargeForm.description.trim(),
        paymentMethod: chargeForm.paymentMethod,
        countryCode: chargeForm.countryCode.trim().toUpperCase() || undefined,
        correlationId: chargeForm.correlationId.trim() || undefined,
      });
      setChargeResult(result);
      setTimelineCorrelationId(result.correlationId);
      setRefundForm((current) => ({
        ...current,
        paymentIntentId: result.paymentIntentId,
        correlationId: result.correlationId,
      }));
    } catch {
      setChargeError('Unable to create POS charge.');
    } finally {
      setChargeLoading(false);
    }
  };

  const submitRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRefundError(null);
    setRefundResult(null);

    if (!refundForm.paymentIntentId.trim()) {
      setRefundError('PaymentIntent ID is required.');
      return;
    }

    const amountMinor = refundForm.amountMinor.trim()
      ? Number.parseInt(refundForm.amountMinor, 10)
      : undefined;

    if (
      refundForm.amountMinor.trim() &&
      (!Number.isInteger(amountMinor) || (amountMinor ?? 0) <= 0)
    ) {
      setRefundError('Partial amount must be a positive integer (minor units).');
      return;
    }

    setRefundLoading(true);
    try {
      const result = await adminApi.createPosRefund({
        paymentIntentId: refundForm.paymentIntentId.trim(),
        amountMinor,
        reason: refundForm.reason.trim() || undefined,
        correlationId: refundForm.correlationId.trim() || undefined,
      });
      setRefundResult(result);
      setTimelineCorrelationId(result.correlationId);
    } catch {
      setRefundError('Unable to create POS refund.');
    } finally {
      setRefundLoading(false);
    }
  };

  const loadTimeline = async () => {
    const correlationId = timelineCorrelationId.trim();
    if (!correlationId) {
      setTimelineError('Correlation ID is required.');
      return;
    }

    setTimelineLoading(true);
    setTimelineError(null);
    try {
      setTimeline(await adminApi.getPosTimeline(correlationId));
    } catch {
      setTimelineError('Unable to load POS timeline.');
    } finally {
      setTimelineLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MADFAM POS</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Operator checkout, routing preview, direct charges, refunds, and reconciliation
          </p>
        </div>
        <Badge variant="secondary" className="capitalize">
          {routeLabel}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="checkout">Subscription</TabsTrigger>
          <TabsTrigger value="route">Route Preview</TabsTrigger>
          <TabsTrigger value="fee-schedule">Fee Schedule</TabsTrigger>
          <TabsTrigger value="charge">Charge / Refund</TabsTrigger>
          <TabsTrigger value="ops">Timeline / Reconcile</TabsTrigger>
        </TabsList>

        <TabsContent value="checkout" className="space-y-6 pt-4">
          {checkoutError && <ErrorBanner message={checkoutError} />}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Checkout Request</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCheckout}>
                  <Field label="User ID" id="checkout-userId" className="md:col-span-2">
                    <Input
                      id="checkout-userId"
                      value={checkoutForm.userId}
                      onChange={(e) => setCheckoutForm((c) => ({ ...c, userId: e.target.value }))}
                      placeholder="user_..."
                      autoComplete="off"
                    />
                  </Field>
                  <SelectField
                    label="Product"
                    id="checkout-product"
                    value={checkoutForm.product}
                    options={PRODUCTS}
                    onChange={(value) => setCheckoutForm((c) => ({ ...c, product: value }))}
                  />
                  <SelectField
                    label="Plan"
                    id="checkout-plan"
                    value={checkoutForm.plan}
                    options={PLANS}
                    onChange={(value) => setCheckoutForm((c) => ({ ...c, plan: value }))}
                  />
                  <Field label="Country" id="checkout-country">
                    <Input
                      id="checkout-country"
                      value={checkoutForm.countryCode}
                      onChange={(e) =>
                        setCheckoutForm((c) => ({ ...c, countryCode: e.target.value }))
                      }
                      maxLength={2}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Organization ID" id="checkout-orgId">
                    <Input
                      id="checkout-orgId"
                      value={checkoutForm.orgId}
                      onChange={(e) => setCheckoutForm((c) => ({ ...c, orgId: e.target.value }))}
                      placeholder="org_..."
                      autoComplete="off"
                    />
                  </Field>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" disabled={checkoutLoading} className="gap-2">
                      {checkoutLoading ? (
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

            <CheckoutResultPanel result={checkoutResult} copied={copied} onCopy={copyCheckoutUrl} />
          </div>

          <CheckoutStatusPanel
            sessionId={statusSessionId}
            onSessionIdChange={setStatusSessionId}
            statusResult={statusResult}
            statusError={statusError}
            statusLoading={statusLoading}
            onLoad={loadStatus}
          />
        </TabsContent>

        <TabsContent value="route">
          <PosRouteTab
            routeForm={routeForm}
            setRouteForm={setRouteForm}
            routePreview={routePreview}
            routeError={routeError}
            routeLoading={routeLoading}
            onPreview={previewRoute}
            overrideProvider={overrideProvider}
            setOverrideProvider={setOverrideProvider}
            overrideReason={overrideReason}
            setOverrideReason={setOverrideReason}
            overrideTtlHours={overrideTtlHours}
            setOverrideTtlHours={setOverrideTtlHours}
            overrideLoading={overrideLoading}
            overrideError={overrideError}
            overrideMessage={overrideMessage}
            onSetOverride={setRouteOverride}
            onClearOverride={clearRouteOverride}
          />
        </TabsContent>

        <TabsContent value="fee-schedule">
          <PosFeeScheduleTab
            schedule={feeSchedule}
            scheduleJson={feeScheduleJson}
            setScheduleJson={setFeeScheduleJson}
            scheduleError={feeScheduleError}
            scheduleLoading={feeScheduleLoading}
            scheduleSaving={feeScheduleSaving}
            scheduleMessage={feeScheduleMessage}
            onReload={() => void loadFeeSchedule()}
            onSave={saveFeeSchedule}
            onClearOverride={() => void clearFeeScheduleOverride()}
          />
        </TabsContent>

        <TabsContent value="charge" className="space-y-6 pt-4">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Direct Charge</CardTitle>
              </CardHeader>
              <CardContent>
                {chargeError && <ErrorBanner message={chargeError} className="mb-4" />}
                <form className="grid gap-4" onSubmit={submitCharge}>
                  <Field label="User ID" id="charge-userId">
                    <Input
                      id="charge-userId"
                      value={chargeForm.userId}
                      onChange={(e) => setChargeForm((c) => ({ ...c, userId: e.target.value }))}
                      autoComplete="off"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Amount (minor units)" id="charge-amount">
                      <Input
                        id="charge-amount"
                        value={chargeForm.amountMinor}
                        onChange={(e) =>
                          setChargeForm((c) => ({ ...c, amountMinor: e.target.value }))
                        }
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Currency" id="charge-currency">
                      <Input
                        id="charge-currency"
                        value={chargeForm.currency}
                        onChange={(e) => setChargeForm((c) => ({ ...c, currency: e.target.value }))}
                        maxLength={3}
                        autoComplete="off"
                      />
                    </Field>
                  </div>
                  <Field label="Description" id="charge-description">
                    <Input
                      id="charge-description"
                      value={chargeForm.description}
                      onChange={(e) =>
                        setChargeForm((c) => ({ ...c, description: e.target.value }))
                      }
                      autoComplete="off"
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Country" id="charge-country">
                      <Input
                        id="charge-country"
                        value={chargeForm.countryCode}
                        onChange={(e) =>
                          setChargeForm((c) => ({ ...c, countryCode: e.target.value }))
                        }
                        maxLength={2}
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Payment method" id="charge-method">
                      <select
                        id="charge-method"
                        value={chargeForm.paymentMethod}
                        onChange={(e) =>
                          setChargeForm((c) => ({
                            ...c,
                            paymentMethod: e.target.value as typeof c.paymentMethod,
                          }))
                        }
                        className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="card">card</option>
                        <option value="oxxo">oxxo</option>
                        <option value="customer_balance">customer_balance (SPEI)</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Correlation ID (optional)" id="charge-correlation">
                    <Input
                      id="charge-correlation"
                      value={chargeForm.correlationId}
                      onChange={(e) =>
                        setChargeForm((c) => ({ ...c, correlationId: e.target.value }))
                      }
                      autoComplete="off"
                    />
                  </Field>
                  <Button type="submit" disabled={chargeLoading} className="gap-2">
                    {chargeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    Create charge
                  </Button>
                </form>
                {chargeResult && (
                  <ResultList
                    className="mt-4"
                    items={[
                      ['Correlation', chargeResult.correlationId],
                      ['Provider', chargeResult.provider],
                      ['PaymentIntent', chargeResult.paymentIntentId],
                      ['Status', chargeResult.status],
                      ['Amount', `${chargeResult.amountMinor} ${chargeResult.currency}`],
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Refund</CardTitle>
              </CardHeader>
              <CardContent>
                {refundError && <ErrorBanner message={refundError} className="mb-4" />}
                <form className="grid gap-4" onSubmit={submitRefund}>
                  <Field label="PaymentIntent ID" id="refund-pi">
                    <Input
                      id="refund-pi"
                      value={refundForm.paymentIntentId}
                      onChange={(e) =>
                        setRefundForm((c) => ({ ...c, paymentIntentId: e.target.value }))
                      }
                      placeholder="pi_..."
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Partial amount (minor units, optional)" id="refund-amount">
                    <Input
                      id="refund-amount"
                      value={refundForm.amountMinor}
                      onChange={(e) =>
                        setRefundForm((c) => ({ ...c, amountMinor: e.target.value }))
                      }
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Reason (optional)" id="refund-reason">
                    <Input
                      id="refund-reason"
                      value={refundForm.reason}
                      onChange={(e) => setRefundForm((c) => ({ ...c, reason: e.target.value }))}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Correlation ID (optional)" id="refund-correlation">
                    <Input
                      id="refund-correlation"
                      value={refundForm.correlationId}
                      onChange={(e) =>
                        setRefundForm((c) => ({ ...c, correlationId: e.target.value }))
                      }
                      autoComplete="off"
                    />
                  </Field>
                  <Button type="submit" disabled={refundLoading} className="gap-2">
                    {refundLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4" />
                    )}
                    Issue refund
                  </Button>
                </form>
                {refundResult && (
                  <ResultList
                    className="mt-4"
                    items={[
                      ['Correlation', refundResult.correlationId],
                      ['Refund', refundResult.refundId],
                      ['Provider', refundResult.provider],
                      ['Status', refundResult.status || 'unknown'],
                      ['Amount', `${refundResult.amountMinor} ${refundResult.currency}`],
                    ]}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ops" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">POS Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timelineError && <ErrorBanner message={timelineError} />}
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <Field label="Correlation ID" id="timeline-correlation">
                  <Input
                    id="timeline-correlation"
                    value={timelineCorrelationId}
                    onChange={(e) => setTimelineCorrelationId(e.target.value)}
                    placeholder="corr-..."
                    autoComplete="off"
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={loadTimeline}
                    disabled={timelineLoading}
                    className="gap-2"
                  >
                    {timelineLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Load timeline
                  </Button>
                </div>
              </div>
              {timeline.length > 0 ? (
                <div className="space-y-3">
                  {timeline.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3 text-sm dark:border-gray-700"
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
                        {event.cfdiUuid ? (
                          <div className="mt-1 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            CFDI {event.cfdiUuid}
                          </div>
                        ) : null}
                        {event.productWebhookDeliveries?.length ? (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {event.productWebhookDeliveries
                              .map((d) => `${d.consumer}:${d.status}`)
                              .join(', ')}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No timeline loaded" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Reconciliation</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void loadReconciliation()}
                disabled={reconciliationLoading}
              >
                {reconciliationLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {reconciliationError && (
                <ErrorBanner message={reconciliationError} className="mb-4" />
              )}
              {reconciliation ? (
                <div className="space-y-4">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Flagged mismatches: </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {reconciliation.flaggedCount}
                    </span>
                  </div>
                  {reconciliation.recentMismatches.length > 0 ? (
                    <div className="space-y-3">
                      {reconciliation.recentMismatches.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950"
                        >
                          <div className="font-medium">{item.type}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            user {item.userId || 'unknown'} ·{' '}
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No flagged reconciliation mismatches" />
                  )}
                </div>
              ) : (
                <EmptyState message="Reconciliation summary not loaded" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
