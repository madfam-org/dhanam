'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/lib/hooks/use-auth';

import {
  Household,
  HouseholdMember,
  HouseholdNetWorth,
  HouseholdGoalSummary,
  CreateHouseholdInput,
  UpdateHouseholdInput,
  AddMemberInput,
  UpdateMemberInput,
} from './useHouseholds';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';

// Query key factory for consistent key management
export const householdsKeys = {
  all: ['households'] as const,
  lists: () => [...householdsKeys.all, 'list'] as const,
  list: () => [...householdsKeys.lists()] as const,
  details: () => [...householdsKeys.all, 'detail'] as const,
  detail: (id: string) => [...householdsKeys.details(), id] as const,
  netWorth: (id: string) => [...householdsKeys.detail(id), 'netWorth'] as const,
  goalSummary: (id: string) => [...householdsKeys.detail(id), 'goalSummary'] as const,
  members: (id: string) => [...householdsKeys.detail(id), 'members'] as const,
};

// Default stale time: 60 seconds for household data (household config changes infrequently)
const DEFAULT_STALE_TIME = 60 * 1000;

async function fetchWithAuth(token: string, url: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
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

export function useHouseholdsList() {
  const { token } = useAuth();

  return useQuery({
    queryKey: householdsKeys.list(),
    queryFn: async (): Promise<Household[]> => {
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, '/households');
    },
    enabled: !!token,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useHouseholdById(id: string | undefined) {
  const { token } = useAuth();

  return useQuery({
    queryKey: householdsKeys.detail(id || ''),
    queryFn: async (): Promise<Household> => {
      if (!id) throw new Error('No household ID');
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `/households/${id}`);
    },
    enabled: !!id && !!token,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useHouseholdNetWorth(id: string | undefined) {
  const { token } = useAuth();

  return useQuery({
    queryKey: householdsKeys.netWorth(id || ''),
    queryFn: async (): Promise<HouseholdNetWorth> => {
      if (!id) throw new Error('No household ID');
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `/households/${id}/net-worth`);
    },
    enabled: !!id && !!token,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useHouseholdGoalSummary(id: string | undefined) {
  const { token } = useAuth();

  return useQuery({
    queryKey: householdsKeys.goalSummary(id || ''),
    queryFn: async (): Promise<HouseholdGoalSummary> => {
      if (!id) throw new Error('No household ID');
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `/households/${id}/goals/summary`);
    },
    enabled: !!id && !!token,
    staleTime: DEFAULT_STALE_TIME,
  });
}

// Mutation Hooks

export function useCreateHousehold() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateHouseholdInput): Promise<Household> => {
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, '/households', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: householdsKeys.list() });
    },
  });
}

export function useUpdateHousehold() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateHouseholdInput;
    }): Promise<Household> => {
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `/households/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: householdsKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: householdsKeys.list() });
    },
  });
}

export function useDeleteHousehold() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!token) throw new Error('No auth token');
      await fetchWithAuth(token, `/households/${id}`, { method: 'DELETE' });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: householdsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: householdsKeys.list() });
    },
  });
}

export function useAddHouseholdMember() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      input,
    }: {
      householdId: string;
      input: AddMemberInput;
    }): Promise<HouseholdMember> => {
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `/households/${householdId}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: householdsKeys.detail(variables.householdId) });
      queryClient.invalidateQueries({ queryKey: householdsKeys.members(variables.householdId) });
    },
  });
}

export function useUpdateHouseholdMember() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      memberId,
      input,
    }: {
      householdId: string;
      memberId: string;
      input: UpdateMemberInput;
    }): Promise<HouseholdMember> => {
      if (!token) throw new Error('No auth token');
      return fetchWithAuth(token, `/households/${householdId}/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: householdsKeys.detail(variables.householdId) });
      queryClient.invalidateQueries({ queryKey: householdsKeys.members(variables.householdId) });
    },
  });
}

export function useRemoveHouseholdMember() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      householdId,
      memberId,
    }: {
      householdId: string;
      memberId: string;
    }): Promise<void> => {
      if (!token) throw new Error('No auth token');
      await fetchWithAuth(token, `/households/${householdId}/members/${memberId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: householdsKeys.detail(variables.householdId) });
      queryClient.invalidateQueries({ queryKey: householdsKeys.members(variables.householdId) });
    },
  });
}
