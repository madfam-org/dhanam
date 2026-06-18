'use client';

import { Badge, Button, Card, Skeleton } from '@dhanam/ui';
import { CheckCircle2, Layers, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { adminApi, type CapitalStackJournalEntry } from '@/lib/api/admin';

export default function CapitalStackAdminPage() {
  const [entries, setEntries] = useState<CapitalStackJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getCapitalStackReviewQueue();
      setEntries(data);
    } catch {
      setError('Failed to load capital stack review queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const resolve = async (
    journalId: string,
    resolution: 'sealed' | 'void',
    karafielCaseId?: string
  ) => {
    setResolvingId(journalId);
    try {
      await adminApi.resolveCapitalStackJournal(journalId, {
        resolution,
        karafielCaseId,
        notes: resolution === 'sealed' ? 'Admin manual seal' : 'Admin void',
      });
      await loadQueue();
    } catch {
      setError('Failed to resolve journal entry.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Capital Stack Review
            </h1>
          </div>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Operator queue for owner–operator journal entries pending compliance resolution
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadQueue()}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Journal</th>
                <th className="px-4 py-3 text-left font-medium">Flow</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Confidence</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    Review queue is empty
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 font-mono text-xs">{entry.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{entry.flowType}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {entry.amount} {entry.currency}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{entry.status}</Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {entry.detectionConfidence != null
                        ? `${Math.round(Number(entry.detectionConfidence) * 100)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolvingId === entry.id}
                          onClick={() =>
                            void resolve(entry.id, 'sealed', entry.karafielCaseId ?? undefined)
                          }
                        >
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Seal
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={resolvingId === entry.id}
                          onClick={() => void resolve(entry.id, 'void')}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Void
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
