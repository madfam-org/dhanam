'use client';

import { Skeleton, Card, Button } from '@dhanam/ui';
import { RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { DeploymentStatusCard } from '~/components/admin/deployment-status';
import { adminApi, type DeploymentStatus } from '~/lib/api/admin';

export default function DeploymentPage() {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getDeploymentStatus();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load deployment status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  if (loading || !status) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deployment Status</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Current deployment information and environment details
          </p>
        </div>
        <Button variant="outline" onClick={loadStatus} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      <div className="max-w-lg">
        <DeploymentStatusCard status={status} />
      </div>
    </div>
  );
}
