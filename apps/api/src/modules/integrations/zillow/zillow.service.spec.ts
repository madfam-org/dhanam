import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
  createFetchResponse,
  createFetchErrorResponse,
} from '../../../../test/helpers/api-mock-factory';
import { TimeTestHelper } from '../../../../test/helpers/time-testing';
import { RedisService } from '../../../core/redis/redis.service';

import { ZillowService } from './zillow.service';

describe('ZillowService', () => {
  let service: ZillowService;
  let redisMock: ReturnType<typeof createRedisMock>;
  let configMock: ReturnType<typeof createConfigMock>;
  let timeHelper: TimeTestHelper;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    timeHelper = new TimeTestHelper();
    originalFetch = global.fetch;

    redisMock = createRedisMock();
    configMock = createConfigMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZillowService,
        { provide: ConfigService, useValue: configMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<ZillowService>(ZillowService);

    // Suppress logger output
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    timeHelper.reset();
  });

  describe('onModuleInit', () => {
    it('should log warning when API key is not configured', () => {
      const logger = (service as any).logger;
      service.onModuleInit();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Zillow API key not configured')
      );
    });

    it('should log success when API key is configured', async () => {
      // Create new service with API key
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      const logger = createLoggerMock();
      (serviceWithKey as any).logger = logger;

      serviceWithKey.onModuleInit();

      expect(logger.log).toHaveBeenCalledWith('Zillow API integration initialized');
    });
  });

  describe('isAvailable', () => {
    it('should return false when API key is not configured', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when API key is configured', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      expect(serviceWithKey.isAvailable()).toBe(true);
    });
  });

  describe('lookupAddress', () => {
    const streetAddress = '123 Main St';
    const city = 'Los Angeles';
    const state = 'CA';
    const zipcode = '90210';

    it('should return cached result when available', async () => {
      const cachedResult = {
        found: true,
        zpid: 'cached-zpid-123',
        formattedAddress: '123 Main St, Los Angeles, CA 90210',
      };

      // Pre-populate cache
      const cacheKey = `zillow:address:${Buffer.from(
        `${streetAddress}|${city}|${state}|${zipcode}`.toLowerCase().replace(/\s+/g, ' ').trim()
      ).toString('base64')}`;

      redisMock = createRedisMock(new Map([[cacheKey, cachedResult]]));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithCache = module.get<ZillowService>(ZillowService);
      (serviceWithCache as any).logger = createLoggerMock();

      const result = await serviceWithCache.lookupAddress(streetAddress, city, state, zipcode);

      expect(result).toEqual(cachedResult);
      expect(redisMock.get).toHaveBeenCalled();
    });

    it('should return mock data when API key is not configured', async () => {
      const result = await service.lookupAddress(streetAddress, city, state, zipcode);

      expect(result.found).toBe(true);
      expect(result.zpid).toMatch(/^mock-/);
      expect(result.formattedAddress).toBe('123 Main St, Los Angeles, CA, 90210');
    });

    it('should return mock data without zipcode', async () => {
      const result = await service.lookupAddress(streetAddress, city, state);

      expect(result.found).toBe(true);
      expect(result.formattedAddress).toBe('123 Main St, Los Angeles, CA');
    });

    it('should call API when key is configured and cache miss', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const apiResponse = {
        bundle: [
          {
            zpid: 'api-zpid-456',
            address: {
              streetAddress: '123 Main St',
              city: 'Los Angeles',
              state: 'CA',
              zipcode: '90210',
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse(apiResponse));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      const result = await serviceWithKey.lookupAddress(streetAddress, city, state, zipcode);

      expect(result.found).toBe(true);
      expect(result.zpid).toBe('api-zpid-456');
      expect(global.fetch).toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalled(); // Should cache result
    });

    it('should return found: false when API returns empty bundle', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ bundle: [] }));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      const result = await serviceWithKey.lookupAddress(streetAddress, city, state);

      expect(result.found).toBe(false);
      expect(result.zpid).toBeUndefined();
    });

    it('should throw error when rate limit exceeded', async () => {
      configMock = createConfigMock({
        ZILLOW_API_KEY: 'test-api-key',
        ZILLOW_RATE_LIMIT: 1,
      });

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ bundle: [] }));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();
      (serviceWithKey as any).config.cacheEnabled = false; // Disable cache for this test

      // First request should succeed
      await serviceWithKey.lookupAddress(streetAddress, city, state);

      // Second request should throw rate limit error
      await expect(serviceWithKey.lookupAddress('456 Oak Ave', city, state)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should reset rate limit counter after one minute', async () => {
      timeHelper.freezeTime(new Date('2025-01-15T10:00:00Z'));

      configMock = createConfigMock({
        ZILLOW_API_KEY: 'test-api-key',
        ZILLOW_RATE_LIMIT: 1,
      });

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ bundle: [] }));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();
      (serviceWithKey as any).config.cacheEnabled = false;

      // First request
      await serviceWithKey.lookupAddress(streetAddress, city, state);

      // Advance time by 61 seconds
      timeHelper.advanceTimeBySeconds(61);

      // Request should work now (rate limit reset)
      const result = await serviceWithKey.lookupAddress('456 Oak Ave', city, state);
      expect(result.found).toBe(false);
    });

    it('should throw error on API failure', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      global.fetch = jest
        .fn()
        .mockResolvedValue(createFetchErrorResponse(500, 'Internal Server Error'));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      await expect(serviceWithKey.lookupAddress(streetAddress, city, state)).rejects.toThrow(
        'Zillow API error: 500 Internal Server Error'
      );
    });
  });

  describe('getPropertyValuation', () => {
    const zpid = 'test-zpid-123';

    it('should return cached result when available', async () => {
      const cachedResult = {
        zpid,
        address: '123 Main St, Los Angeles, CA 90210',
        zestimate: 500000,
        zestimateLow: 475000,
        zestimateHigh: 525000,
        lastUpdated: new Date().toISOString(),
      };

      redisMock = createRedisMock(new Map([[`zillow:valuation:${zpid}`, cachedResult]]));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithCache = module.get<ZillowService>(ZillowService);
      (serviceWithCache as any).logger = createLoggerMock();

      const result = await serviceWithCache.getPropertyValuation(zpid);

      expect(result?.zpid).toBe(zpid);
      expect(result?.zestimate).toBe(500000);
    });

    it('should return mock data when API key is not configured', async () => {
      const result = await service.getPropertyValuation(zpid);

      expect(result).not.toBeNull();
      expect(result?.zpid).toBe(zpid);
      expect(result?.address).toBe('Mock Property Address');
      expect(result?.zestimate).toBeGreaterThan(0);
      expect(result?.zestimateLow).toBeLessThan(result!.zestimate);
      expect(result?.zestimateHigh).toBeGreaterThan(result!.zestimate);
    });

    it('should generate deterministic mock values based on zpid', async () => {
      const result1 = await service.getPropertyValuation(zpid);
      const result2 = await service.getPropertyValuation(zpid);

      expect(result1?.zestimate).toBe(result2?.zestimate);
      expect(result1?.propertyDetails.yearBuilt).toBe(result2?.propertyDetails.yearBuilt);
    });

    it('should call API when key is configured', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const apiResponse = {
        bundle: [
          {
            zpid,
            address: {
              streetAddress: '123 Main St',
              city: 'Los Angeles',
              state: 'CA',
              zipcode: '90210',
            },
            zestimate: 750000,
            zestimateLow: 700000,
            zestimateHigh: 800000,
            rentalZestimate: 3500,
            propertyType: 'SingleFamily',
            yearBuilt: 1985,
            livingArea: 2000,
            bedrooms: 4,
            bathrooms: 2.5,
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse(apiResponse));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      const result = await serviceWithKey.getPropertyValuation(zpid);

      expect(result?.zestimate).toBe(750000);
      expect(result?.propertyDetails.bedrooms).toBe(4);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return null when property not found', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      global.fetch = jest.fn().mockResolvedValue(createFetchErrorResponse(404, 'Not Found'));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      const result = await serviceWithKey.getPropertyValuation('nonexistent-zpid');

      expect(result).toBeNull();
    });

    it('should return null when property has no zestimate', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const apiResponse = {
        bundle: [
          {
            zpid,
            address: { streetAddress: '123 Main St' },
            // No zestimate field
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse(apiResponse));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      const result = await serviceWithKey.getPropertyValuation(zpid);

      expect(result).toBeNull();
    });

    it('should throw error when rate limit exceeded', async () => {
      configMock = createConfigMock({
        ZILLOW_API_KEY: 'test-api-key',
        ZILLOW_RATE_LIMIT: 1,
      });

      global.fetch = jest
        .fn()
        .mockResolvedValue(createFetchResponse({ bundle: [{ zpid, zestimate: 500000 }] }));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();
      (serviceWithKey as any).config.cacheEnabled = false;

      // First request
      await serviceWithKey.getPropertyValuation(zpid);

      // Second request should throw
      await expect(serviceWithKey.getPropertyValuation('another-zpid')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('searchProperties', () => {
    it('should return mock results when API key is not configured', async () => {
      const results = await service.searchProperties('Main Street', 3);

      expect(results).toHaveLength(3);
      expect(results[0].zpid).toMatch(/^mock-search-/);
      expect(results[0].address.city).toBe('Sample City');
    });

    it('should respect limit parameter for mock results', async () => {
      const results = await service.searchProperties('Oak Avenue', 2);

      expect(results).toHaveLength(2);
    });

    it('should return max 3 mock results even when limit is higher', async () => {
      const results = await service.searchProperties('Park Lane', 10);

      expect(results).toHaveLength(3);
    });

    it('should throw error when rate limit exceeded', async () => {
      configMock = createConfigMock({
        ZAPPER_API_KEY: 'test-api-key', // Wrong key intentionally
        ZILLOW_API_KEY: 'test-api-key',
        ZILLOW_RATE_LIMIT: 1,
      });

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ bundle: [] }));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      // Use up rate limit with address lookup
      try {
        await serviceWithKey.lookupAddress('123 Main', 'LA', 'CA');
      } catch {
        // ignore
      }

      // Search should throw
      await expect(serviceWithKey.searchProperties('Oak Ave')).rejects.toThrow(
        'Rate limit exceeded'
      );
    });
  });

  describe('refreshAllPropertyValuations', () => {
    it('should skip refresh when API is not available', async () => {
      const logger = createLoggerMock();
      (service as any).logger = logger;

      await service.refreshAllPropertyValuations();

      expect(logger.debug).toHaveBeenCalledWith(
        'Skipping property refresh - Zillow API not configured'
      );
    });

    it('should log start message when API is available', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      const logger = createLoggerMock();
      (serviceWithKey as any).logger = logger;

      await serviceWithKey.refreshAllPropertyValuations();

      expect(logger.log).toHaveBeenCalledWith('Starting scheduled property valuation refresh');
    });
  });

  describe('cache operations', () => {
    it('should handle cache read errors gracefully', async () => {
      redisMock.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.lookupAddress('123 Main', 'LA', 'CA');

      // Should fall back to mock data
      expect(result.found).toBe(true);
      expect(result.zpid).toMatch(/^mock-/);
    });

    it('should handle cache write errors gracefully', async () => {
      configMock = createConfigMock({ ZILLOW_API_KEY: 'test-api-key' });

      const apiResponse = {
        bundle: [{ zpid: 'api-123', address: {} }],
      };

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse(apiResponse));
      redisMock.set.mockRejectedValue(new Error('Redis write failed'));

      const module = await Test.createTestingModule({
        providers: [
          ZillowService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZillowService>(ZillowService);
      (serviceWithKey as any).logger = createLoggerMock();

      // Should not throw, just log warning
      const result = await serviceWithKey.lookupAddress('123 Main', 'LA', 'CA');
      expect(result.found).toBe(true);
    });
  });

  describe('formatAddress', () => {
    it('should format address with all parts', () => {
      const formatted = (service as any).formatAddress({
        streetAddress: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zipcode: '90210',
      });

      expect(formatted).toBe('123 Main St, Los Angeles, CA, 90210');
    });

    it('should skip undefined parts', () => {
      const formatted = (service as any).formatAddress({
        streetAddress: '123 Main St',
        city: 'Los Angeles',
      });

      expect(formatted).toBe('123 Main St, Los Angeles');
    });
  });

  describe('getAddressCacheKey', () => {
    it('should generate consistent cache keys', () => {
      const key1 = (service as any).getAddressCacheKey('123 Main St', 'LA', 'CA', '90210');
      const key2 = (service as any).getAddressCacheKey('123 Main St', 'LA', 'CA', '90210');

      expect(key1).toBe(key2);
    });

    it('should normalize whitespace', () => {
      const key1 = (service as any).getAddressCacheKey('123  Main St', 'LA', 'CA');
      const key2 = (service as any).getAddressCacheKey('123 Main St', 'LA', 'CA');

      expect(key1).toBe(key2);
    });

    it('should be case-insensitive', () => {
      const key1 = (service as any).getAddressCacheKey('123 Main St', 'LA', 'CA');
      const key2 = (service as any).getAddressCacheKey('123 MAIN ST', 'la', 'ca');

      expect(key1).toBe(key2);
    });
  });
});
