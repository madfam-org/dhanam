'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { adminApi, type RouteFeeSchedule } from '@/lib/api/admin';

export function usePosFeeSchedule(activeTab: string) {
  const [feeSchedule, setFeeSchedule] = useState<RouteFeeSchedule | null>(null);
  const [feeScheduleJson, setFeeScheduleJson] = useState('');
  const [feeScheduleError, setFeeScheduleError] = useState<string | null>(null);
  const [feeScheduleLoading, setFeeScheduleLoading] = useState(false);
  const [feeScheduleSaving, setFeeScheduleSaving] = useState(false);
  const [feeScheduleMessage, setFeeScheduleMessage] = useState<string | null>(null);

  const loadFeeSchedule = useCallback(async () => {
    setFeeScheduleError(null);
    setFeeScheduleLoading(true);
    try {
      const schedule = await adminApi.getRouteFeeSchedule();
      setFeeSchedule(schedule);
      setFeeScheduleJson(
        JSON.stringify({ version: schedule.version, entries: schedule.entries }, null, 2)
      );
    } catch {
      setFeeScheduleError('Unable to load route fee schedule.');
    } finally {
      setFeeScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'fee-schedule' && !feeSchedule && !feeScheduleLoading) {
      void loadFeeSchedule();
    }
  }, [activeTab, feeSchedule, feeScheduleLoading, loadFeeSchedule]);

  const saveFeeSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeeScheduleError(null);
    setFeeScheduleMessage(null);

    let parsed: { version?: string; entries?: unknown[] };
    try {
      parsed = JSON.parse(feeScheduleJson);
    } catch {
      setFeeScheduleError('Schedule JSON is invalid.');
      return;
    }

    if (!parsed.version || !Array.isArray(parsed.entries)) {
      setFeeScheduleError('JSON must include version and entries.');
      return;
    }

    setFeeScheduleSaving(true);
    try {
      const result = await adminApi.upsertRouteFeeSchedule({
        version: parsed.version,
        entries: parsed.entries as RouteFeeSchedule['entries'],
      });
      setFeeScheduleMessage(
        `Saved platform override v${result.version} (${result.entryCount} entries).`
      );
      await loadFeeSchedule();
    } catch {
      setFeeScheduleError('Unable to save fee schedule override.');
    } finally {
      setFeeScheduleSaving(false);
    }
  };

  const clearFeeScheduleOverride = async () => {
    setFeeScheduleError(null);
    setFeeScheduleMessage(null);
    setFeeScheduleSaving(true);
    try {
      const result = await adminApi.clearRouteFeeSchedule();
      setFeeScheduleMessage(`Reverted to bundled schedule v${result.version}.`);
      await loadFeeSchedule();
    } catch {
      setFeeScheduleError('Unable to clear fee schedule override.');
    } finally {
      setFeeScheduleSaving(false);
    }
  };

  return {
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
  };
}
