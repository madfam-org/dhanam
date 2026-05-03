'use client';

import { Card, Button, Badge } from '@dhanam/ui';
import { RefreshCw, Trash2, ListChecks } from 'lucide-react';
import { useState } from 'react';

import type { QueueInfo } from '~/lib/api/admin';
import { adminApi } from '~/lib/api/admin';

interface QueueCardProps {
  queue: QueueInfo;
  onRefresh: () => void;
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  idle: 'secondary',
  error: 'destructive',
};

export function QueueCard({ queue, onRefresh }: QueueCardProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleRetry = async () => {
    setLoading('retry');
    try {
      await adminApi.retryFailedJobs(queue.name);
      onRefresh();
    } catch (error) {
      console.error('Failed to retry jobs:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(`Clear all jobs in queue "${queue.name}"?`)) return;
    setLoading('clear');
    try {
      await adminApi.clearQueue(queue.name);
      onRefresh();
    } catch (error) {
      console.error('Failed to clear queue:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <ListChecks className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
            {queue.name}
          </h4>
        </div>
        <Badge variant={statusVariants[queue.status] || 'outline'}>{queue.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <p className="text-lg font-bold text-gray-900 dark:text-white">{queue.recentJobs}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Recent Jobs</p>
        </div>
        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <p
            className={`text-lg font-bold ${queue.failedJobs > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
          >
            {queue.failedJobs}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={loading !== null || queue.failedJobs === 0}
          className="flex-1 flex items-center justify-center space-x-1"
        >
          <RefreshCw className={`h-3 w-3 ${loading === 'retry' ? 'animate-spin' : ''}`} />
          <span>Retry Failed</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center space-x-1"
        >
          <Trash2 className="h-3 w-3" />
          <span>Clear</span>
        </Button>
      </div>
    </Card>
  );
}
