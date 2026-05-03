'use client';

import { Card, Badge } from '@dhanam/ui';
import { Server, GitBranch, Clock, Cpu } from 'lucide-react';

import type { DeploymentStatus as DeploymentStatusType } from '~/lib/api/admin';

interface DeploymentStatusProps {
  status: DeploymentStatusType;
}

export function DeploymentStatusCard({ status }: DeploymentStatusProps) {
  const items = [
    {
      label: 'Version',
      value: status.version,
      icon: Server,
    },
    {
      label: 'Commit SHA',
      value: status.commitSha.slice(0, 8),
      icon: GitBranch,
      mono: true,
    },
    {
      label: 'Build Time',
      value: new Date(status.buildTime).toLocaleString(),
      icon: Clock,
    },
    {
      label: 'Node.js',
      value: status.nodeVersion,
      icon: Cpu,
    },
  ];

  const envColors: Record<string, string> = {
    production: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    staging: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    development: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deployment</h3>
        <Badge className={envColors[status.environment] || envColors.development} variant="outline">
          {status.environment}
        </Badge>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <div className="flex items-center space-x-2">
              <item.icon className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
            </div>
            <span
              className={`text-sm font-medium text-gray-900 dark:text-white ${item.mono ? 'font-mono' : ''}`}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
