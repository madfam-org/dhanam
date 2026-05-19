import axios from 'axios';
import { DhanamESGProvider } from '../providers/dhanam-provider';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('DhanamESGProvider', () => {
  let provider: DhanamESGProvider;

  const mockApiResponse = {
    symbol: 'btc',
    name: 'Bitcoin',
    score: {
      overall: 45,
      environmental: 20,
      social: 60,
      governance: 55,
      confidence: 80,
      lastUpdated: new Date().toISOString(),
      sources: ['Dhanam Analysis', 'On-chain data'],
    },
    metrics: {
      consensusMechanism: 'pow',
      energyIntensity: 100,
      carbonIntensity: 500,
      decentralizationScore: 85,
      developerActivity: 70,
      communityEngagement: 80,
    },
    category: 'cryptocurrency',
    marketCap: 1000000000000,
    volume24h: 50000000000,
  };

  beforeEach(() => {
    mockedAxios.create.mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: mockApiResponse }),
    } as any);

    provider = new DhanamESGProvider({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.test.com',
      cacheTTL: 3600000,
    });

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      mockedAxios.create.mockReturnValue({ get: jest.fn() } as any);
      const defaultProvider = new DhanamESGProvider();
      expect(defaultProvider.name).toBe('Dhanam');
    });

    it('should create instance with custom config', () => {
      mockedAxios.create.mockReturnValue({ get: jest.fn() } as any);
      const customProvider = new DhanamESGProvider({
        apiKey: 'my-api-key',
        baseUrl: 'https://custom.api.com',
      });
      expect(customProvider.name).toBe('Dhanam');
    });
  });

  describe('getAssetESG', () => {
    it('should fetch and transform ESG data', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: mockApiResponse }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const result = await testProvider.getAssetESG('BTC');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('BTC');
      expect(result?.name).toBe('Bitcoin');
      expect(result?.score.overall).toBe(45);
      expect(result?.score.methodology).toBe('Dhanam v2.0');
      expect(result?.metrics.consensusMechanism).toBe('pow');
    });

    it('should return cached data if not expired', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: mockApiResponse }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider({ cacheTTL: 60000 });

      // First call
      await testProvider.getAssetESG('BTC');
      // Second call should use cache
      await testProvider.getAssetESG('BTC');

      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });

    it('should return fallback data on API error', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const result = await testProvider.getAssetESG('BTC');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('BTC');
      expect(result?.score.methodology).toBe('Dhanam Fallback v1.0');
    });

    it('should return fallback scores for known cryptocurrencies', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();

      // BTC fallback
      const btcResult = await testProvider.getAssetESG('BTC');
      expect(btcResult?.score.overall).toBe(45);
      expect(btcResult?.score.environmental).toBe(20); // PoW penalty

      // ETH fallback
      const ethResult = await testProvider.getAssetESG('ETH');
      expect(ethResult?.score.overall).toBe(65);
      expect(ethResult?.score.environmental).toBe(50); // PoS bonus

      // ALGO fallback (best ESG)
      const algoResult = await testProvider.getAssetESG('ALGO');
      expect(algoResult?.score.overall).toBe(80);
      expect(algoResult?.score.environmental).toBe(90);
    });

    it('should return generic fallback for unknown symbols', async () => {
      const mockClient = {
        get: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const result = await testProvider.getAssetESG('UNKNOWN');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('UNKNOWN');
      expect(result?.score.overall).toBe(50); // Default neutral score
    });
  });

  describe('getMultipleAssetESG', () => {
    it('should fetch multiple assets', async () => {
      const mockClient = {
        get: jest
          .fn()
          .mockResolvedValueOnce({ data: mockApiResponse })
          .mockResolvedValueOnce({ data: { ...mockApiResponse, symbol: 'eth', name: 'Ethereum' } }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const results = await testProvider.getMultipleAssetESG(['BTC', 'ETH']);

      expect(results).toHaveLength(2);
      expect(results[0].symbol).toBe('BTC');
      expect(results[1].symbol).toBe('ETH');
    });

    it('should filter out null results', async () => {
      const mockClient = {
        get: jest
          .fn()
          .mockResolvedValueOnce({ data: mockApiResponse })
          .mockRejectedValueOnce(new Error('Not found')),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const results = await testProvider.getMultipleAssetESG(['BTC', 'INVALID']);

      // Should return at least BTC (and fallback for INVALID)
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('refreshAssetData', () => {
    it('should clear cache and refetch', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: mockApiResponse }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();

      // Populate cache
      await testProvider.getAssetESG('BTC');

      // Refresh
      await testProvider.refreshAssetData('BTC');

      // Should have made two API calls
      expect(mockClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache management', () => {
    it('should clear all cache', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: mockApiResponse }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      await testProvider.getAssetESG('BTC');

      expect(testProvider.getCacheSize()).toBe(1);

      testProvider.clearCache();

      expect(testProvider.getCacheSize()).toBe(0);
    });

    it('should report cache size', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: mockApiResponse }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();

      expect(testProvider.getCacheSize()).toBe(0);

      await testProvider.getAssetESG('BTC');
      await testProvider.getAssetESG('ETH');

      expect(testProvider.getCacheSize()).toBe(2);
    });
  });

  describe('data transformation', () => {
    it('should uppercase symbol', async () => {
      const mockClient = {
        get: jest.fn().mockResolvedValue({
          data: { ...mockApiResponse, symbol: 'btc' },
        }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const result = await testProvider.getAssetESG('btc');

      expect(result?.symbol).toBe('BTC');
    });

    it('should handle missing fields gracefully', async () => {
      const incompleteResponse = {
        symbol: 'btc',
        // name missing
        score: {
          overall: 45,
          // some fields missing
        },
        metrics: {
          // minimal metrics
        },
      };

      const mockClient = {
        get: jest.fn().mockResolvedValue({ data: incompleteResponse }),
      };
      mockedAxios.create.mockReturnValue(mockClient as any);

      const testProvider = new DhanamESGProvider();
      const result = await testProvider.getAssetESG('BTC');

      expect(result).toBeDefined();
      expect(result?.symbol).toBe('BTC');
      expect(result?.name).toBe('');
      expect(result?.score.overall).toBe(45);
      expect(result?.score.environmental).toBe(0);
      expect(result?.metrics.consensusMechanism).toBe('other');
    });
  });
});
