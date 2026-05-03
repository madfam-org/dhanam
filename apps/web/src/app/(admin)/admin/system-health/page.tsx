'use client';

import { Card, Skeleton, Button } from '@dhanam/ui';
import { RefreshCw, Users, Activity } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { CacheControls } from '~/components/admin/cache-controls';
import { HealthStatusCard } from '~/components/admin/health-status-card';
import { StatsCard } from '~/components/admin/stats-card';
import { adminApi, type SystemHealth, type Metrics } from '~/lib/api/admin';

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, m] = await Promise.all([adminApi.getSystemHealth(), adminApi.getMetrics()]);
      setHealth(h);
      setMetrics(m);
    } catch (error) {
      console.error('Failed to load system health:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading || !health || !metrics) {
    return <SystemHealthSkeleton />;
  }

  const services = [
    {
      name: 'Database',
      status: health.database.status,
      detail: `${health.database.connections} connections`,
    },
    {
      name: 'Redis',
      status: health.redis.status,
      detail: health.redis.connected ? 'Connected' : 'Disconnected',
    },
    { name: 'Job Queues', status: health.queues.status },
    { name: 'Providers', status: health.providers.status },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Monitor system status and performance
          </p>
        </div>
        <Button variant="outline" onClick={loadData} className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      <HealthStatusCard services={services} uptime={health.uptime} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="DAU" value={metrics.dau} icon={Users} color="blue" />
        <StatsCard title="WAU" value={metrics.wau} icon={Users} color="green" />
        <StatsCard title="MAU" value={metrics.mau} icon={Users} color="purple" />
        <StatsCard
          title="Memory Usage"
          value={`${metrics.resourceUsage.memoryMB} MB`}
          icon={Activity}
          color="orange"
        />
      </div>

      <CacheControls />
    </div>
  );
}

function SystemHealthSkeleton() {
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
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12 mt-2" />
          </Card>
        ))}
      </div>
    </div>
  );
}
