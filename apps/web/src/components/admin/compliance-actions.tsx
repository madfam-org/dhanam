'use client';

import { Card, Input, Button } from '@dhanam/ui';
import { Download, Trash2, Clock } from 'lucide-react';
import { useState } from 'react';

import { adminApi } from '~/lib/api/admin';

export function ComplianceActions() {
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGdprExport = async () => {
    if (!userId.trim()) return;
    setLoading('export');
    setMessage(null);
    try {
      const data = await adminApi.gdprExport(userId);
      // Trigger download as JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${userId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'GDPR export downloaded successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setLoading(null);
    }
  };

  const handleGdprDelete = async () => {
    if (!userId.trim()) return;
    if (
      !window.confirm(
        `This will queue deletion of ALL data for user ${userId}. This action cannot be undone. Continue?`
      )
    )
      return;
    setLoading('delete');
    setMessage(null);
    try {
      const result = await adminApi.gdprDelete(userId);
      setMessage({
        type: 'success',
        text: `Deletion queued. Job ID: ${result.jobId}`,
      });
      setUserId('');
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Deletion failed' });
    } finally {
      setLoading(null);
    }
  };

  const handleRetention = async () => {
    if (!window.confirm('Execute data retention policies now?')) return;
    setLoading('retention');
    setMessage(null);
    try {
      const result = await adminApi.executeRetention();
      setMessage({
        type: 'success',
        text: `Retention execution initiated. Job ID: ${result.jobId}`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Retention execution failed',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">GDPR Actions</h3>
        <div className="flex space-x-3 mb-4">
          <Input
            type="text"
            placeholder="User ID"
            value={userId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={handleGdprExport}
            disabled={loading !== null || !userId.trim()}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>{loading === 'export' ? 'Exporting...' : 'Export Data'}</span>
          </Button>
          <Button
            onClick={handleGdprDelete}
            disabled={loading !== null || !userId.trim()}
            variant="destructive"
            className="flex items-center space-x-2"
          >
            <Trash2 className="h-4 w-4" />
            <span>{loading === 'delete' ? 'Queuing...' : 'Delete Data'}</span>
          </Button>
        </div>

        {message && (
          <div
            className={`p-3 rounded text-sm ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Data Retention</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Execute data retention policies to clean up expired data according to configured rules.
        </p>
        <Button
          onClick={handleRetention}
          disabled={loading !== null}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <Clock className="h-4 w-4" />
          <span>{loading === 'retention' ? 'Executing...' : 'Execute Retention Policies'}</span>
        </Button>
      </Card>
    </div>
  );
}
