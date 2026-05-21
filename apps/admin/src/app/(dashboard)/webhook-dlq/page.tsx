'use client';

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@dhanam/ui';
import { CheckCircle2, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { adminApi, type WebhookDlqFailure } from '@/lib/api/admin';

const PAGE_SIZE = 25;

export default function WebhookDlqPage() {
  const [failures, setFailures] = useState<WebhookDlqFailure[]>([]);
  const [consumer, setConsumer] = useState('');
  const [since, setSince] = useState('');
  const [includeResolved, setIncludeResolved] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [resolutionReason, setResolutionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const resolutionReasonRef = useRef<HTMLInputElement | null>(null);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadFailures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.listWebhookDlqFailures({
        consumer: consumer.trim() || undefined,
        since: since.trim() || undefined,
        includeResolved,
        limit: PAGE_SIZE,
        offset,
      });
      setFailures(response.items);
      setTotal(response.total);
    } catch (_err) {
      setError('Failed to load webhook delivery failures.');
    } finally {
      setLoading(false);
    }
  }, [consumer, includeResolved, offset, since]);

  useEffect(() => {
    loadFailures();
  }, [loadFailures]);

  const replayFailure = async (failure: WebhookDlqFailure) => {
    setActionId(`${failure.id}:replay`);
    setError(null);
    setMessage(null);
    try {
      const result = await adminApi.replayWebhookDlqFailure(failure.id);
      setMessage(
        result.ok
          ? `Replay delivered for ${failure.consumer}.`
          : `Replay attempted for ${failure.consumer}; delivery is still failing.`
      );
      await loadFailures();
    } catch (_err) {
      setError('Failed to replay webhook delivery.');
    } finally {
      setActionId(null);
    }
  };

  const resolveFailure = async (failure: WebhookDlqFailure) => {
    const reasonInput = document.getElementById('resolutionReason') as HTMLInputElement | null;
    const currentReason =
      reasonInput?.value ?? resolutionReasonRef.current?.value ?? resolutionReason;
    setActionId(`${failure.id}:resolve`);
    setError(null);
    setMessage(null);
    try {
      await adminApi.resolveWebhookDlqFailure(failure.id, currentReason);
      setMessage(`Marked ${failure.consumer} delivery resolved.`);
      await loadFailures();
    } catch (_err) {
      setError('Failed to mark webhook delivery resolved.');
    } finally {
      setActionId(null);
    }
  };

  const resetAndRefresh = () => {
    setMessage(null);
    if (offset === 0) {
      void loadFailures();
      return;
    }
    setOffset(0);
  };

  const goToPreviousPage = () => {
    setOffset((current) => Math.max(0, current - PAGE_SIZE));
  };

  const goToNextPage = () => {
    setOffset((current) => Math.min((totalPages - 1) * PAGE_SIZE, current + PAGE_SIZE));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Webhook DLQ</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Replay or close failed product webhook deliveries
          </p>
        </div>
        <Badge variant={total > 0 ? 'destructive' : 'secondary'}>
          {includeResolved ? `${total} rows` : `${total} open`}
        </Badge>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recovery Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div>
              <Label htmlFor="consumer">Consumer</Label>
              <Input
                id="consumer"
                value={consumer}
                onChange={(event) => {
                  setConsumer(event.target.value);
                  setOffset(0);
                }}
                placeholder="karafiel"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="since">Since</Label>
              <Input
                id="since"
                value={since}
                onChange={(event) => {
                  setSince(event.target.value);
                  setOffset(0);
                }}
                placeholder="2026-05-21T00:00:00Z"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="resolutionReason">Resolve reason</Label>
              <Input
                id="resolutionReason"
                ref={resolutionReasonRef}
                value={resolutionReason}
                onChange={(event) => setResolutionReason(event.target.value)}
                placeholder="CFDI issued manually"
                autoComplete="off"
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex h-10 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={includeResolved}
                  onChange={(event) => {
                    setIncludeResolved(event.target.checked);
                    setOffset(0);
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Include resolved
              </label>
              <Button type="button" onClick={resetAndRefresh} disabled={loading} className="gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Delivery
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Last Error
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Next Retry
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading webhook delivery failures
                  </td>
                </tr>
              ) : failures.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No webhook delivery failures found
                  </td>
                </tr>
              ) : (
                failures.map((failure) => {
                  const isResolved = Boolean(failure.resolvedAt);
                  const replaying = actionId === `${failure.id}:replay`;
                  const resolving = actionId === `${failure.id}:resolve`;

                  return (
                    <tr key={failure.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-4 align-top">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {failure.consumer}
                        </div>
                        <div className="mt-1 max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
                          {failure.consumerUrl}
                        </div>
                        <div className="mt-2">
                          <Badge variant={isResolved ? 'secondary' : 'destructive'}>
                            {isResolved ? 'resolved' : 'open'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="font-mono text-sm text-gray-900 dark:text-white">
                          {failure.eventType || 'unknown'}
                        </div>
                        <div className="mt-1 max-w-xs truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                          {failure.eventId}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(failure.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                        <div>{failure.attemptCount}</div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Status {failure.lastStatusCode ?? 'network'}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="max-w-sm text-sm text-gray-700 dark:text-gray-300">
                          {failure.lastErrorMessage || '-'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Last attempt {formatDate(failure.lastAttemptAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-gray-700 dark:text-gray-300">
                        {isResolved
                          ? 'Resolved'
                          : failure.nextRetryAt
                            ? formatDate(failure.nextRetryAt)
                            : 'Manual only'}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => replayFailure(failure)}
                            disabled={Boolean(actionId)}
                            className="gap-2"
                          >
                            {replaying ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            Replay
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => resolveFailure(failure)}
                            disabled={Boolean(actionId) || isResolved}
                            className="gap-2"
                          >
                            {resolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Resolve
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={page === 1 || loading}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={page === totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}
