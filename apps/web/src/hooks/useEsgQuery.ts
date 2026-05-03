'use client';

import { useQuery, useMutation } from '@tanstack/react-query';

import { esgApi } from '@/lib/api/esg';

import { EsgScore, PortfolioEsgAnalysis, AssetComparison, EsgTrends } from './useEsg';

// Query key factory for consistent key management
export const esgKeys = {
  all: ['esg'] as const,
  assetScore: (symbol: string, assetType: string) =>
    [...esgKeys.all, 'asset', symbol, assetType] as const,
  portfolio: () => [...esgKeys.all, 'portfolio'] as const,
  comparison: (symbols: string[]) => [...esgKeys.all, 'comparison', ...symbols] as const,
  trends: () => [...esgKeys.all, 'trends'] as const,
  methodology: () => [...esgKeys.all, 'methodology'] as const,
};

// Default stale time: 5 minutes for ESG data (doesn't change frequently)
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

// Query Hooks

export function useAssetScore(symbol: string | undefined, assetType = 'crypto') {
  return useQuery({
    queryKey: esgKeys.assetScore(symbol || '', assetType),
    queryFn: async (): Promise<EsgScore> => {
      if (!symbol) throw new Error('No symbol');
      return esgApi.getAssetScore(symbol, assetType);
    },
    enabled: !!symbol,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function usePortfolioEsgAnalysis() {
  return useQuery({
    queryKey: esgKeys.portfolio(),
    queryFn: async (): Promise<PortfolioEsgAnalysis> => {
      return esgApi.getPortfolioAnalysis();
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useAssetComparison(symbols: string[] | undefined) {
  return useQuery({
    queryKey: esgKeys.comparison(symbols || []),
    queryFn: async (): Promise<AssetComparison> => {
      if (!symbols || symbols.length === 0) throw new Error('No symbols');
      return esgApi.compareAssets(symbols);
    },
    enabled: !!symbols && symbols.length > 0,
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useEsgTrends() {
  return useQuery({
    queryKey: esgKeys.trends(),
    queryFn: async (): Promise<EsgTrends> => {
      return esgApi.getTrends();
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

export function useEsgMethodology() {
  return useQuery({
    queryKey: esgKeys.methodology(),
    queryFn: async () => {
      return esgApi.getMethodology();
    },
    staleTime: DEFAULT_STALE_TIME,
  });
}

// Mutation for comparing assets on-demand (when symbols are not known upfront)
export function useCompareAssetsMutation() {
  return useMutation({
    mutationFn: async (symbols: string[]): Promise<AssetComparison> => {
      return esgApi.compareAssets(symbols);
    },
  });
}
