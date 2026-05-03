'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/hooks/use-auth';

import {
  Goal,
  GoalProgress,
  GoalSummary,
  GoalProbabilityResult,
  GoalShare,
  GoalActivity,
  CreateGoalInput,
  UpdateGoalInput,
  AddAllocationInput,
  ShareGoalInput,
  WhatIfScenario,
} from './useGoals';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';

// Query key factory for consistent key management
export const goalsKeys = {
  all: ['goals'] as const,
  lists: () => [...goalsKeys.all, 'list'] as const,
  list: (spaceId: string) => [...goalsKeys.lists(), spaceId] as const,
  summary: (spaceId: string) => [...goalsKeys.all, 'summary', spaceId] as const,
  details: () => [...goalsKeys.all, 'detail'] as const,
  detail: (goalId: string) => [...goalsKeys.details(), goalId] as const,
  progress: (goalId: string) => [...goalsKeys.detail(goalId), 'progress'] as const,
  probability: (goalId: string) => [...goalsKeys.detail(goalId), 'probability'] as const,
  shares: (goalId: string) => [...goalsKeys.detail(goalId), 'shares'] as const,
  activities: (goalId: string) => [...goalsKeys.detail(goalId), 'activities'] as const,
  shared: () => [...goalsKeys.all, 'shared'] as const,
};

// Default stale time: 60 seconds for goals data (goals change infrequently)
const DEFAULT_STALE_TIME = 60 * 1000;

async function fetchWithAuth(token: string, endpoint: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}/goals/${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Query Hooks

export function useGoalsBySpace(spaceId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.list(spaceId || ''),
    queryFn: async (): Promise<Goal[]> => {
      if (!spaceId) throw new Error('No space ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `space/${spaceId}`);
    },
    enabled: !!spaceId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useGoalSummary(spaceId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.summary(spaceId || ''),
    queryFn: async (): Promise<GoalSummary> => {
      if (!spaceId) throw new Error('No space ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `space/${spaceId}/summary`);
    },
    enabled: !!spaceId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useGoalById(goalId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.detail(goalId || ''),
    queryFn: async (): Promise<Goal> => {
      if (!goalId) throw new Error('No goal ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, goalId);
    },
    enabled: !!goalId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useGoalProgress(goalId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.progress(goalId || ''),
    queryFn: async (): Promise<GoalProgress> => {
      if (!goalId) throw new Error('No goal ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/progress`);
    },
    enabled: !!goalId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useGoalProbability(goalId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.probability(goalId || ''),
    queryFn: async (): Promise<GoalProbabilityResult> => {
      if (!goalId) throw new Error('No goal ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/probability`);
    },
    enabled: !!goalId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useGoalShares(goalId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.shares(goalId || ''),
    queryFn: async (): Promise<GoalShare[]> => {
      if (!goalId) throw new Error('No goal ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/shares`);
    },
    enabled: !!goalId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useGoalActivities(goalId: string | undefined) {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.activities(goalId || ''),
    queryFn: async (): Promise<GoalActivity[]> => {
      if (!goalId) throw new Error('No goal ID');
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/activities`);
    },
    enabled: !!goalId,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useSharedGoals() {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: goalsKeys.shared(),
    queryFn: async (): Promise<Goal[]> => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, 'shared/me');
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

// Mutation Hooks

export function useCreateGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<Goal> => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, '', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.list(variables.spaceId) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.summary(variables.spaceId) });
    },
  });
}

export function useUpdateGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      goalId,
      input,
    }: {
      goalId: string;
      input: UpdateGoalInput;
    }): Promise<Goal> => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, goalId, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.list(data.spaceId) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.summary(data.spaceId) });
    },
  });
}

export function useDeleteGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId }: { goalId: string; spaceId: string }): Promise<void> => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      await fetchWithAuth(token, goalId, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.list(variables.spaceId) });
      queryClient.invalidateQueries({ queryKey: goalsKeys.summary(variables.spaceId) });
    },
  });
}

export function useAddAllocation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, input }: { goalId: string; input: AddAllocationInput }) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/allocations`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.detail(variables.goalId) });
    },
  });
}

export function useRemoveAllocation() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ goalId, accountId }: { goalId: string; accountId: string }) => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      await fetchWithAuth(token, `${goalId}/allocations/${accountId}`, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.detail(variables.goalId) });
    },
  });
}

export function useShareGoal() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      goalId,
      input,
    }: {
      goalId: string;
      input: ShareGoalInput;
    }): Promise<GoalShare> => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/share`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsKeys.shares(variables.goalId) });
    },
  });
}

export function useRunWhatIfScenario() {
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: async ({
      goalId,
      scenario,
    }: {
      goalId: string;
      scenario: WhatIfScenario;
    }): Promise<GoalProbabilityResult> => {
      const token = await getToken();
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `${goalId}/what-if`, {
        method: 'POST',
        body: JSON.stringify(scenario),
      });
    },
  });
}
