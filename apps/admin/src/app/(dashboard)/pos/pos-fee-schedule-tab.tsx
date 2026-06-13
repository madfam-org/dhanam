'use client';

import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from '@dhanam/ui';
import { Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react';
import type { FormEvent } from 'react';

import type { RouteFeeSchedule } from '@/lib/api/admin';

import { EmptyState, ErrorBanner, Field } from './pos-shared';

export function PosFeeScheduleTab({
  schedule,
  scheduleJson,
  setScheduleJson,
  scheduleError,
  scheduleLoading,
  scheduleSaving,
  scheduleMessage,
  onReload,
  onSave,
  onClearOverride,
}: {
  schedule: RouteFeeSchedule | null;
  scheduleJson: string;
  setScheduleJson: (value: string) => void;
  scheduleError: string | null;
  scheduleLoading: boolean;
  scheduleSaving: boolean;
  scheduleMessage: string | null;
  onReload: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onClearOverride: () => void;
}) {
  return (
    <div className="space-y-6 pt-4">
      {scheduleError && <ErrorBanner message={scheduleError} />}
      {scheduleMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {scheduleMessage}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg">Route Fee Schedule</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={scheduleLoading}
            onClick={onReload}
          >
            {scheduleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Reload
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule ? (
            <dl className="grid gap-2 text-sm md:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Version</dt>
                <dd className="font-mono">{schedule.version}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-mono">{schedule.source}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entries</dt>
                <dd>{schedule.entries.length}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState message="Load the fee schedule to view or edit PSP rate assumptions." />
          )}

          <form className="space-y-4" onSubmit={onSave}>
            <Field label="Schedule JSON (entries array)" id="fee-schedule-json">
              <Textarea
                id="fee-schedule-json"
                value={scheduleJson}
                onChange={(e) => setScheduleJson(e.target.value)}
                rows={18}
                className="font-mono text-xs"
                placeholder='{"version":"2026-06-12","entries":[...]}'
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={scheduleSaving || !scheduleJson.trim()}>
                {scheduleSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save platform override
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={scheduleSaving || schedule?.source !== 'platform_config'}
                onClick={onClearOverride}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Revert to bundled JSON
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Overrides are stored in platform_config under billing.route_fee_schedule. Bundled
              defaults live in payment-route-fee-schedule.json and ship with the API image.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
