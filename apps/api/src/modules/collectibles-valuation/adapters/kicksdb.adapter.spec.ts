import { KicksDbAdapter } from './kicksdb.adapter';

describe('KicksDbAdapter', () => {
  let adapter: KicksDbAdapter;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, KICKSDB_API_KEY: 'test-key' };
    adapter = new KicksDbAdapter();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('search', () => {
    it('should map KicksDB products to CatalogItem format', async () => {
      const mockResponse = {
        products: [
          {
            id: 'kdb-123',
            name: 'Air Jordan 1 Chicago',
            brand: 'Jordan',
            sku: 'CW2288-111',
            image_url: 'https://img.example.com/aj1.jpg',
            colorway: 'White/Red',
            retail_price: 170,
            release_date: '2020-02-20',
            estimated_market_value: 310,
          },
        ],
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await adapter.search('jordan', 10);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          externalId: 'kdb-123',
          provider: 'kicksdb',
          category: 'sneaker',
          name: 'Air Jordan 1 Chicago',
          brand: 'Jordan',
          referenceNumber: 'CW2288-111',
          currentMarketValue: 310,
          currency: 'USD',
        })
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products?query=jordan&limit=10'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
        })
      );
    });

    it('should return empty array on API error', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const results = await adapter.search('jordan', 10);
      expect(results).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const results = await adapter.search('jordan', 10);
      expect(results).toEqual([]);
    });

    it('should return empty array when API key is not configured', async () => {
      delete process.env.KICKSDB_API_KEY;
      const noKeyAdapter = new KicksDbAdapter();

      const results = await noKeyAdapter.search('jordan', 10);
      expect(results).toEqual([]);
    });
  });

  describe('getValuation', () => {
    it('should map price data to ValuationResult', async () => {
      const mockPriceData = {
        estimated_market_value: 310,
        price_low: 290,
        price_high: 350,
        last_sale_price: 305,
        last_sale_date: '2025-01-15',
        price_change_30d: -2.5,
      };

      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockPriceData,
      } as Response);

      const result = await adapter.getValuation('kdb-123');

      expect(result).toBeDefined();
      expect(result!.marketValue).toBe(310);
      expect(result!.valueLow).toBe(290);
      expect(result!.valueHigh).toBe(350);
      expect(result!.lastSalePrice).toBe(305);
      expect(result!.priceChange30d).toBe(-2.5);
      expect(result!.provider).toBe('kicksdb');
      expect(result!.currency).toBe('USD');
      expect(result!.source).toBe('kicksdb');
    });

    it('should return null when product not found', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await adapter.getValuation('UNKNOWN');
      expect(result).toBeNull();
    });

    it('should return null when no market value available', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ estimated_market_value: null }),
      } as Response);

      const result = await adapter.getValuation('kdb-123');
      expect(result).toBeNull();
    });

    it('should return null when API key is not configured', async () => {
      delete process.env.KICKSDB_API_KEY;
      const noKeyAdapter = new KicksDbAdapter();

      const result = await noKeyAdapter.getValuation('kdb-123');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await adapter.getValuation('kdb-123');
      expect(result).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return true when search succeeds', async () => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          products: [{ id: 'x', name: 'Test', estimated_market_value: 100 }],
        }),
      } as Response);

      const result = await adapter.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when API key is not configured', async () => {
      delete process.env.KICKSDB_API_KEY;
      const noKeyAdapter = new KicksDbAdapter();

      const result = await noKeyAdapter.healthCheck();
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'));

      const result = await adapter.healthCheck();
      expect(result).toBe(false);
    });
  });
});
