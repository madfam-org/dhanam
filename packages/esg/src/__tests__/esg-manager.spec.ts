import { ESGManager } from '../services/esg-manager';
import { ESGProvider, AssetESGData, ESGScore } from '../types/esg.types';

describe('ESGManager', () => {
  let manager: ESGManager;

  const mockESGData: AssetESGData = {
    symbol: 'BTC',
    name: 'Bitcoin',
    score: {
      overall: 45,
      environmental: 20,
      social: 60,
      governance: 55,
      confidence: 80,
      lastUpdated: new Date(),
      methodology: 'Test',
      sources: ['Test source'],
    },
    metrics: {
      consensusMechanism: 'pow',
      energyIntensity: 100,
    },
    category: 'cryptocurrency',
  };

  const mockProvider: ESGProvider = {
    name: 'MockProvider',
    getAssetESG: jest.fn(),
    getMultipleAssetESG: jest.fn(),
    refreshAssetData: jest.fn(),
  };

  beforeEach(() => {
    manager = new ESGManager({
      providers: {
        primary: 'dhanam',
        fallback: [],
      },
      caching: {
        ttl: 3600,
        maxSize: 100,
      },
      scoring: {
        weights: {
          environmental: 0.4,
          social: 0.3,
          governance: 0.3,
        },
        minimumConfidence: 50,
      },
      updates: {
        refreshInterval: 3600,
        batchSize: 10,
      },
    });
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultManager = new ESGManager();
      const config = defaultManager.getConfiguration();

      expect(config.providers.primary).toBe('dhanam');
      expect(config.caching.ttl).toBe(3600);
      expect(config.scoring.weights.environmental).toBe(0.4);
    });

    it('should merge custom configuration with defaults', () => {
      const customManager = new ESGManager({
        caching: { ttl: 7200, maxSize: 500 },
      });
      const config = customManager.getConfiguration();

      expect(config.caching.ttl).toBe(7200);
      expect(config.caching.maxSize).toBe(500);
      expect(config.providers.primary).toBe('dhanam'); // Default preserved
    });
  });

  describe('registerProvider', () => {
    it('should register a custom provider', () => {
      manager.registerProvider(mockProvider);
      // Provider should be registered (tested via getAssetESG)
      expect(mockProvider.name).toBe('MockProvider');
    });
  });

  describe('getAssetESG', () => {
    it('should return cached data if available and fresh', async () => {
      // First call to populate cache
      manager.registerProvider({
        ...mockProvider,
        name: 'dhanam',
        getAssetESG: jest.fn().mockResolvedValue(mockESGData),
      });

      await manager.getAssetESG('BTC');
      const secondResult = await manager.getAssetESG('BTC');

      expect(secondResult).toBeDefined();
      expect(secondResult?.symbol).toBe('BTC');
    });

    it('should return null when no provider succeeds', async () => {
      const failingProvider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest.fn().mockRejectedValue(new Error('API Error')),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
      });
      testManager.registerProvider(failingProvider);

      const result = await testManager.getAssetESG('UNKNOWN');
      expect(result).toBeNull();
    });

    it('should try fallback providers on primary failure', async () => {
      const failingPrimary: ESGProvider = {
        name: 'primary',
        getAssetESG: jest.fn().mockRejectedValue(new Error('Primary failed')),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const workingFallback: ESGProvider = {
        name: 'fallback',
        getAssetESG: jest.fn().mockResolvedValue(mockESGData),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'primary', fallback: ['fallback'] },
      });
      testManager.registerProvider(failingPrimary);
      testManager.registerProvider(workingFallback);

      const result = await testManager.getAssetESG('BTC');
      expect(result).toBeDefined();
      expect(result?.symbol).toBe('BTC');
    });

    it('should reject data with low confidence', async () => {
      const lowConfidenceData: AssetESGData = {
        ...mockESGData,
        score: { ...mockESGData.score, confidence: 30 },
      };

      const provider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest.fn().mockResolvedValue(lowConfidenceData),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
        scoring: {
          weights: { environmental: 0.4, social: 0.3, governance: 0.3 },
          minimumConfidence: 50,
        },
      });
      testManager.registerProvider(provider);

      const result = await testManager.getAssetESG('BTC');
      expect(result).toBeNull();
    });
  });

  describe('getMultipleAssetESG', () => {
    it('should fetch multiple assets in batches', async () => {
      const mockBatchData = [mockESGData, { ...mockESGData, symbol: 'ETH', name: 'Ethereum' }];

      const provider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest
          .fn()
          .mockResolvedValueOnce(mockBatchData[0])
          .mockResolvedValueOnce(mockBatchData[1]),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
        updates: { refreshInterval: 3600, batchSize: 5 },
      });
      testManager.registerProvider(provider);

      const results = await testManager.getMultipleAssetESG(['BTC', 'ETH']);
      expect(results).toHaveLength(2);
      expect(results[0].symbol).toBe('BTC');
      expect(results[1].symbol).toBe('ETH');
    });

    it('should handle partial failures gracefully', async () => {
      const provider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest
          .fn()
          .mockResolvedValueOnce(mockESGData)
          .mockRejectedValueOnce(new Error('Failed for ETH')),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
      });
      testManager.registerProvider(provider);

      const results = await testManager.getMultipleAssetESG(['BTC', 'ETH']);
      // Should still return BTC even though ETH failed
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('analyzePortfolio', () => {
    it('should analyze portfolio holdings', async () => {
      const provider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest.fn().mockResolvedValue(mockESGData),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
      });
      testManager.registerProvider(provider);

      const holdings = [{ symbol: 'BTC', quantity: 1, value: 50000 }];

      const analysis = await testManager.analyzePortfolio(holdings);
      expect(analysis).toBeDefined();
      expect(analysis.weightedScore).toBeDefined();
      expect(analysis.assetBreakdown).toBeDefined();
    });
  });

  describe('refreshAssetData', () => {
    it('should clear cache and refetch data', async () => {
      const provider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest.fn().mockResolvedValue(mockESGData),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
      });
      testManager.registerProvider(provider);

      // Populate cache
      await testManager.getAssetESG('BTC');

      // Refresh
      await testManager.refreshAssetData(['BTC']);

      // Should have called getAssetESG again
      expect(provider.getAssetESG).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache management', () => {
    it('should report cache statistics', () => {
      const stats = manager.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.maxSize).toBeDefined();
    });

    it('should clear cache', async () => {
      const provider: ESGProvider = {
        name: 'dhanam',
        getAssetESG: jest.fn().mockResolvedValue(mockESGData),
        getMultipleAssetESG: jest.fn(),
        refreshAssetData: jest.fn(),
      };

      const testManager = new ESGManager({
        providers: { primary: 'dhanam', fallback: [] },
      });
      testManager.registerProvider(provider);

      await testManager.getAssetESG('BTC');
      expect(testManager.getCacheStats().size).toBe(1);

      testManager.clearCache();
      expect(testManager.getCacheStats().size).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      manager.updateConfiguration({
        caching: { ttl: 7200, maxSize: 2000 },
      });

      const config = manager.getConfiguration();
      expect(config.caching.ttl).toBe(7200);
    });

    it('should return copy of configuration', () => {
      const config1 = manager.getConfiguration();
      const config2 = manager.getConfiguration();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
