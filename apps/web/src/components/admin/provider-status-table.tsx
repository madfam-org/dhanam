'use client';

import { Card, Badge } from '@dhanam/ui';

import type { ProviderHealth } from '~/lib/api/admin';

interface ProviderStatusTableProps {
  providers: ProviderHealth[];
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  healthy: 'default',
  degraded: 'secondary',
  down: 'destructive',
};

export function ProviderStatusTable({ providers }: ProviderStatusTableProps) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Accounts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Sync
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {providers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No provider data available
                </td>
              </tr>
            ) : (
              providers.map((provider) => (
                <tr key={provider.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {provider.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={statusVariants[provider.status] || 'outline'}>
                      {provider.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {provider.accountCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {provider.lastSyncAt
                        ? new Date(provider.lastSyncAt).toLocaleString()
                        : 'Never'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
