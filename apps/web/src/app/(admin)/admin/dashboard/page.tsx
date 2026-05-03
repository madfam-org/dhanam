'use client';

import { Card, Skeleton } from '@dhanam/ui';
import { Users, Building2, CreditCard, Receipt, TrendingUp, Shield } from 'lucide-react';

import { StatsCard } from '~/components/admin/stats-card';
import { useAdmin } from '~/contexts/AdminContext';

export default function AdminDashboard() {
  const { systemStats, isLoading } = useAdmin();

  if (isLoading || !systemStats) {
    return <DashboardSkeleton />;
  }

  const statsCards = [
    {
      title: 'Total Users',
      value: systemStats.users.total,
      subtitle: `${systemStats.users.verified} verified`,
      icon: Users,
      color: 'blue' as const,
    },
    {
      title: 'Active Users (30d)',
      value: systemStats.users.active30Days,
      subtitle: `${Math.round((systemStats.users.active30Days / systemStats.users.total) * 100)}% of total`,
      icon: TrendingUp,
      color: 'green' as const,
    },
    {
      title: 'Total Spaces',
      value: systemStats.spaces.total,
      subtitle: `${systemStats.spaces.personal} personal, ${systemStats.spaces.business} business`,
      icon: Building2,
      color: 'purple' as const,
    },
    {
      title: 'Connected Accounts',
      value: systemStats.accounts.connected,
      subtitle: `${systemStats.accounts.total} total accounts`,
      icon: CreditCard,
      color: 'orange' as const,
    },
    {
      title: 'Transactions',
      value: systemStats.transactions.total,
      subtitle: `${systemStats.transactions.last30Days} in last 30 days`,
      icon: Receipt,
      color: 'pink' as const,
    },
    {
      title: '2FA Enabled',
      value: systemStats.users.withTotp,
      subtitle: `${Math.round((systemStats.users.withTotp / systemStats.users.total) * 100)}% of users`,
      icon: Shield,
      color: 'indigo' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">System overview and statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statsCards.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            subtitle={stat.subtitle}
            icon={stat.icon}
            color={stat.color}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Account Providers
          </h2>
          <div className="space-y-3">
            {Object.entries(systemStats.accounts.byProvider).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                  {provider}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction Insights
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Categorization Rate</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round(
                  (systemStats.transactions.categorized / systemStats.transactions.total) * 100
                )}
                %
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">Avg per Day (30d)</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round(systemStats.transactions.last30Days / 30)}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
