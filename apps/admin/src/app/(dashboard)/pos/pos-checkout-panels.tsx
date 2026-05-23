'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from '@dhanam/ui';
import { Copy, ExternalLink, Loader2, Search } from 'lucide-react';

import type { PosCheckoutResult, PosCheckoutStatus } from '@/lib/api/admin';

import { EmptyState, ErrorBanner, Field, ResultList, formatAmount } from './pos-shared';

export function CheckoutResultPanel({
  result,
  copied,
  onCopy,
}: {
  result: PosCheckoutResult | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Checkout Link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? (
          <>
            <ResultList
              items={[
                ['Provider', result.provider],
                ['Product', `${result.product}/${result.plan}`],
                ['Session ID', result.sessionId || 'Unavailable'],
              ]}
            />
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 break-all">
              {result.checkoutUrl}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={onCopy}>
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
          <EmptyState message="No checkout link created" />
        )}
      </CardContent>
    </Card>
  );
}

export function CheckoutStatusPanel({
  sessionId,
  onSessionIdChange,
  statusResult,
  statusError,
  statusLoading,
  onLoad,
}: {
  sessionId: string;
  onSessionIdChange: (value: string) => void;
  statusResult: PosCheckoutStatus | null;
  statusError: string | null;
  statusLoading: boolean;
  onLoad: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Checkout Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusError && <ErrorBanner message={statusError} />}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Session ID" id="statusSessionId">
            <Input
              id="statusSessionId"
              value={sessionId}
              onChange={(e) => onSessionIdChange(e.target.value)}
              placeholder="cs_..."
              autoComplete="off"
            />
          </Field>
          <div className="flex items-end">
            <Button type="button" onClick={onLoad} disabled={statusLoading} className="gap-2">
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
          <CheckoutStatusBody statusResult={statusResult} />
        ) : (
          <EmptyState message="No checkout status loaded" />
        )}
      </CardContent>
    </Card>
  );
}

function CheckoutStatusBody({ statusResult }: { statusResult: PosCheckoutStatus }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <ResultList
        items={[
          ['Provider', statusResult.provider],
          ['Checkout', statusResult.status || 'unknown'],
          ['Payment', statusResult.paymentStatus || 'unknown'],
          ['Product', statusResult.product || 'unknown'],
          ['Plan', statusResult.plan || 'unknown'],
          ['User', statusResult.userId || 'unknown'],
          ['Subscription', statusResult.subscriptionId || 'none'],
          ['Amount', formatAmount(statusResult.amountTotal, statusResult.currency)],
        ]}
      />
      <BillingEventsList events={statusResult.billingEvents} />
    </div>
  );
}

function BillingEventsList({ events }: { events: PosCheckoutStatus['billingEvents'] }) {
  return (
    <div className="rounded-md border border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
        Recent Billing Events
      </div>
      {events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 text-sm last:border-0 last:pb-0 dark:border-gray-800"
            >
              <div>
                <div className="font-medium text-gray-900 dark:text-white">{event.type}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(event.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <Badge variant="secondary">{event.status}</Badge>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {event.amount} {event.currency}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No billing events found" />
      )}
    </div>
  );
}
