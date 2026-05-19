'use client';

import { Card } from '@dhanam/ui';

interface ServiceHealth {
  name: string;
  status: string;
  detail?: string;
}

interface HealthStatusCardProps {
  services: ServiceHealth[];
  uptime?: number;
}

const statusColors: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  down: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  idle: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
};

const statusDots: Record<string, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  down: 'bg-red-500',
  active: 'bg-green-500',
  idle: 'bg-gray-400',
  error: 'bg-red-500',
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function HealthStatusCard({ services, uptime }: HealthStatusCardProps) {
  const overallHealthy = services.every(
    (s) => s.status === 'healthy' || s.status === 'active' || s.status === 'idle'
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Health</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            overallHealthy
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {overallHealthy ? 'All Systems Operational' : 'Issues Detected'}
        </span>
      </div>

      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex items-center space-x-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${statusDots[service.status] || 'bg-gray-400'}`}
              />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {service.name}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {service.detail && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{service.detail}</span>
              )}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  statusColors[service.status] || statusColors.idle
                }`}
              >
                {service.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {uptime !== undefined && (
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">Uptime: {formatUptime(uptime)}</p>
        </div>
      )}
    </Card>
  );
}
