'use client';

import { useState, useCallback } from 'react';

import {
  manualAssetsApi,
  ManualAsset,
  ManualAssetSummary,
  CashFlow,
  CreateCashFlowDto,
  PerformanceAnalysis,
  PEPortfolioAnalysis,
  AssetDocument,
  DocumentConfig,
  UploadUrlResponse,
  Valuation,
  CreateValuationDto,
} from '@/lib/api/manual-assets';

export function useManualAssets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===============================
  // Core Asset Operations
  // ===============================

  const listAssets = useCallback(async (spaceId: string): Promise<ManualAsset[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await manualAssetsApi.listAssets(spaceId);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to list assets';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAssetSummary = useCallback(
    async (spaceId: string): Promise<ManualAssetSummary | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.getAssetSummary(spaceId);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get asset summary';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getAsset = useCallback(
    async (spaceId: string, assetId: string): Promise<ManualAsset | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.getAsset(spaceId, assetId);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get asset';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createAsset = useCallback(
    async (
      spaceId: string,
      data: Omit<ManualAsset, 'id' | 'spaceId' | 'createdAt' | 'updatedAt'>
    ): Promise<ManualAsset | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await manualAssetsApi.createAsset(spaceId, data);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create asset';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteAsset = useCallback(async (spaceId: string, assetId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await manualAssetsApi.deleteAsset(spaceId, assetId);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete asset';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // ===============================
  // Valuations
  // ===============================

  const addValuation = useCallback(
    async (
      spaceId: string,
      assetId: string,
      data: CreateValuationDto
    ): Promise<Valuation | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await manualAssetsApi.addValuation(spaceId, assetId, data);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add valuation';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ===============================
  // Cash Flow Management
  // ===============================

  const listCashFlows = useCallback(
    async (spaceId: string, assetId: string): Promise<CashFlow[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.listCashFlows(spaceId, assetId);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to list cash flows';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createCashFlow = useCallback(
    async (spaceId: string, assetId: string, data: CreateCashFlowDto): Promise<CashFlow | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await manualAssetsApi.createCashFlow(spaceId, assetId, data);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create cash flow';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteCashFlow = useCallback(
    async (spaceId: string, assetId: string, cashFlowId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await manualAssetsApi.deleteCashFlow(spaceId, assetId, cashFlowId);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete cash flow';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ===============================
  // Performance Analysis
  // ===============================

  const getPerformanceAnalysis = useCallback(
    async (spaceId: string, assetId: string): Promise<PerformanceAnalysis | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.getPerformanceAnalysis(spaceId, assetId);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get performance analysis';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ===============================
  // PE Portfolio Analytics
  // ===============================

  const getPEPortfolioAnalysis = useCallback(
    async (spaceId: string): Promise<PEPortfolioAnalysis | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.getPEPortfolioAnalysis(spaceId);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to get PE portfolio analysis';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ===============================
  // Document Management
  // ===============================

  const getDocumentConfig = useCallback(async (spaceId: string): Promise<DocumentConfig | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await manualAssetsApi.getDocumentConfig(spaceId);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get document config';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const listDocuments = useCallback(
    async (spaceId: string, assetId: string): Promise<AssetDocument[] | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.listDocuments(spaceId, assetId);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to list documents';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getUploadUrl = useCallback(
    async (
      spaceId: string,
      assetId: string,
      filename: string,
      contentType: string,
      category?: string
    ): Promise<UploadUrlResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.getUploadUrl(
          spaceId,
          assetId,
          filename,
          contentType,
          category
        );
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get upload URL';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const confirmUpload = useCallback(
    async (
      spaceId: string,
      assetId: string,
      documentKey: string,
      description?: string
    ): Promise<AssetDocument | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.confirmUpload(
          spaceId,
          assetId,
          documentKey,
          description
        );
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to confirm upload';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getDownloadUrl = useCallback(
    async (
      spaceId: string,
      assetId: string,
      documentKey: string
    ): Promise<{ downloadUrl: string; expiresAt: string } | null> => {
      setLoading(true);
      setError(null);
      try {
        const data = await manualAssetsApi.getDownloadUrl(spaceId, assetId, documentKey);
        return data;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get download URL';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const deleteDocument = useCallback(
    async (spaceId: string, assetId: string, documentKey: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await manualAssetsApi.deleteDocument(spaceId, assetId, documentKey);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    // Core Asset Operations
    listAssets,
    getAssetSummary,
    getAsset,
    createAsset,
    deleteAsset,
    // Valuations
    addValuation,
    // Cash Flow Management
    listCashFlows,
    createCashFlow,
    deleteCashFlow,
    // Performance Analysis
    getPerformanceAnalysis,
    // PE Portfolio Analytics
    getPEPortfolioAnalysis,
    // Document Management
    getDocumentConfig,
    listDocuments,
    getUploadUrl,
    confirmUpload,
    getDownloadUrl,
    deleteDocument,
  };
}
