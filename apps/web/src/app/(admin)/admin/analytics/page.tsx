'use client';

import { Card, Progress, Skeleton } from '@dhanam/ui';
import {
  Users,
  UserCheck,
  Mail,
  Link,
  Target,
  CheckCircle,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { adminApi, type OnboardingFunnel } from '~/lib/api/admin';

export default function AnalyticsPage(): JSX.Element {
  const [funnel, setFunnel] = useState<OnboardingFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getOnboardingFunnel();
      setFunnel(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !funnel) {
    return <AnalyticsSkeleton />;
  }

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'sign_up':
        return Users;
      case 'email_verification':
        return Mail;
      case 'space_setup':
        return Target;
      case 'connect_accounts':
        return Link;
      case 'first_budget':
        return Target;
      case 'onboarding_complete':
        return CheckCircle;
      default:
        return UserCheck;
    }
  };

  const getStepName = (step: string) => {
    return step
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          User onboarding funnel and conversion metrics
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Signups</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {funnel.total.toLocaleString()}
              </p>
            </div>
            <Users className="h-8 w-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {funnel.completion.rate.toFixed(1)}%
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg. Time</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {funnel.completion.averageTimeMinutes} min
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
      </div>

      {/* Funnel Visualization */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Onboarding Funnel
        </h2>
        <div className="space-y-4">
          {funnel.steps.map((step, index) => {
            const Icon = getStepIcon(step.step);
            const isLastStep = index === funnel.steps.length - 1;

            return (
              <div key={step.step}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getStepName(step.step)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {step.count.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      ({step.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <Progress value={step.percentage} className="h-2" />

                {!isLastStep &&
                  index < funnel.dropoff.length &&
                  funnel.dropoff[index] &&
                  (() => {
                    const dropoff = funnel.dropoff[index];
                    if (!dropoff) return null;
                    return (
                      <div className="mt-2 mb-4 pl-8 text-sm text-red-600 dark:text-red-400 flex items-center">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        {dropoff.count} dropped off ({dropoff.percentage.toFixed(1)}%)
                      </div>
                    );
                  })()}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Dropoff Analysis */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Dropoff Analysis
        </h2>
        <div className="space-y-3">
          {funnel.dropoff.map((drop) => (
            <div
              key={`${drop.fromStep}-${drop.toStep}`}
              className="flex items-center justify-between"
            >
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {getStepName(drop.fromStep)}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {getStepName(drop.toStep)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  -{drop.count}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({drop.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AnalyticsSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16 mt-2" />
              </div>
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
