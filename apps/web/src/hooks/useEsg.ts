'use client';

import { useState, useCallback } from 'react';

import { esgApi } from '@/lib/api/esg';

export interface EsgScore {
  symbol: string;
  assetType: 'crypto' | 'equity' | 'etf';
  environmentalScore: number;
  socialScore: number;
  governanceScore: number;
  overallScore: number;
  grade: string;
  energyIntensity?: number;
  carbonFootprint?: number;
  consensusMechanism?: string;
  description?: string;
  lastUpdated: string;
}

export interface PortfolioEsgAnalysis {
  overallScore: number;
  grade: string;
  breakdown: {
    environmental: number;
    social: number;
    governance: number;
  };
  holdings: Array<{
    symbol: string;
    weight: number;
    esgScore: EsgScore;
  }>;
  insights: string[];
  methodology: string;
  analysisDate: string;
}

export interface AssetComparison {
  comparison: EsgScore[];
  bestPerformer: {
    overall: string;
    environmental: string;
    social: string;
    governance: string;
  };
  summary: string;
  methodology: string;
  comparisonDate: string;
}

export interface EsgTrends {
  trending: {
    improving: string[];
    declining: string[];
  };
  recommendations: string[];
  marketInsights: string[];
  methodology: string;
  lastUpdated: string;
}

export function useEsg() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAssetScore = useCallback(async (symbol: string, assetType = 'crypto') => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getAssetScore(symbol, assetType);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ESG score';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPortfolioAnalysis = useCallback(async (): Promise<PortfolioEsgAnalysis | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getPortfolioAnalysis();
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch portfolio ESG analysis';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const compareAssets = useCallback(async (symbols: string[]): Promise<AssetComparison | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.compareAssets(symbols);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compare assets';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTrends = useCallback(async (): Promise<EsgTrends | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getTrends();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ESG trends';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getMethodology = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getMethodology();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch methodology';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ===============================
  // V2 Methods - Enhanced ESG API
  // ===============================

  const getAssetScoreV2 = useCallback(async (symbol: string, assetType = 'crypto') => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getAssetScoreV2(symbol, assetType);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ESG score (v2)';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPortfolioAnalysisV2 = useCallback(async (): Promise<PortfolioEsgAnalysis | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getPortfolioAnalysisV2();
      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch portfolio ESG analysis (v2)';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSpacePortfolioV2 = useCallback(
    async (spaceId: string): Promise<PortfolioEsgAnalysis | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await esgApi.getSpacePortfolioV2(spaceId);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch space portfolio ESG analysis';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const compareAssetsV2 = useCallback(
    async (symbols: string[]): Promise<AssetComparison | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await esgApi.compareAssetsV2(symbols);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to compare assets (v2)';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getTrendsV2 = useCallback(async (): Promise<EsgTrends | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getTrendsV2();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch ESG trends (v2)';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshESGData = useCallback(
    async (symbols: string[]): Promise<{ refreshed: string[]; errors: string[] } | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await esgApi.refreshESGData(symbols);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to refresh ESG data';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getCacheStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.getCacheStats();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch cache stats';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCache = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await esgApi.clearCache();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear cache';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    // V1 Methods
    getAssetScore,
    getPortfolioAnalysis,
    compareAssets,
    getTrends,
    getMethodology,
    // V2 Methods
    getAssetScoreV2,
    getPortfolioAnalysisV2,
    getSpacePortfolioV2,
    compareAssetsV2,
    getTrendsV2,
    refreshESGData,
    getCacheStats,
    clearCache,
  };
}
