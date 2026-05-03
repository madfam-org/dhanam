'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { adminApi } from '~/lib/api/admin';
import type { SystemStats, FeatureFlag } from '~/lib/api/admin';

interface AdminContextType {
  systemStats: SystemStats | null;
  featureFlags: FeatureFlag[];
  isLoading: boolean;
  refreshStats: () => Promise<void>;
  refreshFeatureFlags: () => Promise<void>;
  updateFeatureFlag: (key: string, updates: Partial<FeatureFlag>) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshStats = async () => {
    try {
      const stats = await adminApi.getSystemStats();
      setSystemStats(stats);
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
    }
  };

  const refreshFeatureFlags = async () => {
    try {
      const flags = await adminApi.getFeatureFlags();
      setFeatureFlags(flags);
    } catch (error) {
      console.error('Failed to fetch feature flags:', error);
    }
  };

  const updateFeatureFlag = async (key: string, updates: Partial<FeatureFlag>) => {
    try {
      const updated = await adminApi.updateFeatureFlag(key, updates);
      setFeatureFlags((prev) => prev.map((flag) => (flag.key === key ? updated : flag)));
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      throw error;
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await Promise.all([refreshStats(), refreshFeatureFlags()]);
      setIsLoading(false);
    };

    loadInitialData();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reason: React 19 type incompatibility with Context.Provider requires cast to any
  const Provider = AdminContext.Provider as any;
  return (
    <Provider
      value={{
        systemStats,
        featureFlags,
        isLoading,
        refreshStats,
        refreshFeatureFlags,
        updateFeatureFlag,
      }}
    >
      {children}
    </Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
