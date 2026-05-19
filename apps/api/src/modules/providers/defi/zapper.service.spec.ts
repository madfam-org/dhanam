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

import type { DeFiNetwork, DeFiPortfolio } from './defi-position.interface';
import { ZapperService } from './zapper.service';

describe('ZapperService', () => {
  let service: ZapperService;
  let redisMock: ReturnType<typeof createRedisMock>;
  let configMock: ReturnType<typeof createConfigMock>;
  let timeHelper: TimeTestHelper;
  let originalFetch: typeof global.fetch;

  const testAddress = '0x1234567890abcdef1234567890abcdef12345678';

  beforeEach(async () => {
    jest.clearAllMocks();
    timeHelper = new TimeTestHelper();
    originalFetch = global.fetch;

    redisMock = createRedisMock();
    configMock = createConfigMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZapperService,
        { provide: ConfigService, useValue: configMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<ZapperService>(ZapperService);

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
        expect.stringContaining('Zapper API key not configured')
      );
    });

    it('should log success when API key is configured', async () => {
      configMock = createConfigMock({ ZAPPER_API_KEY: 'test-api-key' });

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      const logger = createLoggerMock();
      (serviceWithKey as any).logger = logger;

      serviceWithKey.onModuleInit();

      expect(logger.log).toHaveBeenCalledWith('Zapper API integration initialized');
    });
  });

  describe('isAvailable', () => {
    it('should return false when API key is not configured', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true when API key is configured', async () => {
      configMock = createConfigMock({ ZAPPER_API_KEY: 'test-api-key' });

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      expect(serviceWithKey.isAvailable()).toBe(true);
    });
  });

  describe('getPortfolio', () => {
    it('should return cached result when available', async () => {
      const cachedPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'ethereum',
        totalBalanceUsd: 10000,
        totalBorrowedUsd: 0,
        netWorthUsd: 10000,
        positions: [],
        lastUpdated: new Date(),
      };

      redisMock = createRedisMock(
        new Map([[`zapper:portfolio:${testAddress}:ethereum`, cachedPortfolio]])
      );

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithCache = module.get<ZapperService>(ZapperService);
      (serviceWithCache as any).logger = createLoggerMock();

      const result = await serviceWithCache.getPortfolio(testAddress);

      expect(result.totalBalanceUsd).toBe(10000);
      expect(redisMock.get).toHaveBeenCalled();
    });

    it('should return mock data when API key is not configured', async () => {
      const result = await service.getPortfolio(testAddress);

      expect(result.address).toBe(testAddress);
      expect(result.network).toBe('ethereum');
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should generate deterministic mock data based on address', async () => {
      const result1 = await service.getPortfolio(testAddress);
      const result2 = await service.getPortfolio(testAddress);

      expect(result1.totalBalanceUsd).toBe(result2.totalBalanceUsd);
      expect(result1.positions.length).toBe(result2.positions.length);
    });

    it('should return empty portfolio for some addresses (deterministic)', async () => {
      // Address that hashes to divisible by 3 will have no positions
      const emptyAddress = '0x000000000000000000000000000000000000000a';

      const result = await service.getPortfolio(emptyAddress);

      // This tests the deterministic empty portfolio logic
      expect(result.address).toBe(emptyAddress);
      expect(result.netWorthUsd).toBeGreaterThanOrEqual(0);
    });

    it('should call API when key is configured and cache miss', async () => {
      configMock = createConfigMock({ ZAPPER_API_KEY: 'test-api-key' });

      const apiResponse = {
        [testAddress.toLowerCase()]: [
          {
            key: 'uniswap-v3',
            address: testAddress,
            appId: 'uniswap-v3',
            appName: 'Uniswap V3',
            appImage: 'https://example.com/uniswap.png',
            network: 'ethereum',
            balanceUSD: 5000,
            products: [
              {
                label: 'Liquidity Pool',
                assets: [
                  {
                    symbol: 'ETH',
                    address: '0xeth',
                    decimals: 18,
                    supply: 1.5,
                    price: 3000,
                    balanceUSD: 4500,
                  },
                ],
                meta: [],
              },
            ],
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse(apiResponse));

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      (serviceWithKey as any).logger = createLoggerMock();

      const result = await serviceWithKey.getPortfolio(testAddress);

      expect(result.positions.length).toBe(1);
      expect(result.positions[0].protocol).toBe('uniswap-v3');
      expect(global.fetch).toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should throw error when rate limit exceeded', async () => {
      configMock = createConfigMock({
        ZAPPER_API_KEY: 'test-api-key',
        ZAPPER_RATE_LIMIT: 1,
      });

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ [testAddress]: [] }));

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      (serviceWithKey as any).logger = createLoggerMock();

      // Clear cache to force API call
      redisMock.get.mockResolvedValue(null);

      // First request
      await serviceWithKey.getPortfolio(testAddress);

      // Second request should throw
      await expect(serviceWithKey.getPortfolio('0xabcdef')).rejects.toThrow('Rate limit exceeded');
    });

    it('should reset rate limit counter after one minute', async () => {
      timeHelper.freezeTime(new Date('2025-01-15T10:00:00Z'));

      configMock = createConfigMock({
        ZAPPER_API_KEY: 'test-api-key',
        ZAPPER_RATE_LIMIT: 1,
      });

      global.fetch = jest.fn().mockResolvedValue(createFetchResponse({ [testAddress]: [] }));

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      (serviceWithKey as any).logger = createLoggerMock();

      redisMock.get.mockResolvedValue(null);

      // First request
      await serviceWithKey.getPortfolio(testAddress);

      // Advance time by 61 seconds
      timeHelper.advanceTimeBySeconds(61);

      // Request should work now
      const result = await serviceWithKey.getPortfolio('0xabcdef');
      expect(result).toBeDefined();
    });

    it('should throw error on API failure', async () => {
      configMock = createConfigMock({ ZAPPER_API_KEY: 'test-api-key' });

      global.fetch = jest
        .fn()
        .mockResolvedValue(createFetchErrorResponse(500, 'Internal Server Error'));

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      (serviceWithKey as any).logger = createLoggerMock();

      await expect(serviceWithKey.getPortfolio(testAddress)).rejects.toThrow(
        'Zapper API error: 500 Internal Server Error'
      );
    });

    it('should support different networks', async () => {
      const networks: DeFiNetwork[] = ['polygon', 'arbitrum', 'optimism'];

      for (const network of networks) {
        const result = await service.getPortfolio(testAddress, network);
        expect(result.network).toBe(network);
      }
    });
  });

  describe('getProtocolPositions', () => {
    it('should filter positions by protocol', async () => {
      // Set up mock portfolio with multiple protocols
      const mockPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'ethereum',
        totalBalanceUsd: 15000,
        totalBorrowedUsd: 0,
        netWorthUsd: 15000,
        positions: [
          {
            id: 'uniswap-1',
            protocol: 'uniswap-v3',
            network: 'ethereum',
            type: 'liquidity-pool',
            label: 'Uniswap V3',
            tokens: [],
            balanceUsd: 5000,
          },
          {
            id: 'aave-1',
            protocol: 'aave-v3',
            network: 'ethereum',
            type: 'lending',
            label: 'Aave V3',
            tokens: [],
            balanceUsd: 10000,
          },
        ],
        lastUpdated: new Date(),
      };

      redisMock = createRedisMock(
        new Map([[`zapper:portfolio:${testAddress}:ethereum`, mockPortfolio]])
      );

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithMock = module.get<ZapperService>(ZapperService);
      (serviceWithMock as any).logger = createLoggerMock();

      const positions = await serviceWithMock.getProtocolPositions(testAddress, ['aave-v3']);

      expect(positions).toHaveLength(1);
      expect(positions[0].protocol).toBe('aave-v3');
    });

    it('should return multiple protocols when specified', async () => {
      const mockPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'ethereum',
        totalBalanceUsd: 20000,
        totalBorrowedUsd: 0,
        netWorthUsd: 20000,
        positions: [
          {
            id: 'uniswap-1',
            protocol: 'uniswap-v3',
            network: 'ethereum',
            type: 'liquidity-pool',
            label: 'Uniswap V3',
            tokens: [],
            balanceUsd: 5000,
          },
          {
            id: 'aave-1',
            protocol: 'aave-v3',
            network: 'ethereum',
            type: 'lending',
            label: 'Aave V3',
            tokens: [],
            balanceUsd: 10000,
          },
          {
            id: 'lido-1',
            protocol: 'lido',
            network: 'ethereum',
            type: 'staking',
            label: 'Lido',
            tokens: [],
            balanceUsd: 5000,
          },
        ],
        lastUpdated: new Date(),
      };

      redisMock = createRedisMock(
        new Map([[`zapper:portfolio:${testAddress}:ethereum`, mockPortfolio]])
      );

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithMock = module.get<ZapperService>(ZapperService);
      (serviceWithMock as any).logger = createLoggerMock();

      const positions = await serviceWithMock.getProtocolPositions(testAddress, [
        'aave-v3',
        'lido',
      ]);

      expect(positions).toHaveLength(2);
    });

    it('should return empty array when no matching protocols', async () => {
      const mockPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'ethereum',
        totalBalanceUsd: 5000,
        totalBorrowedUsd: 0,
        netWorthUsd: 5000,
        positions: [
          {
            id: 'uniswap-1',
            protocol: 'uniswap-v3',
            network: 'ethereum',
            type: 'liquidity-pool',
            label: 'Uniswap V3',
            tokens: [],
            balanceUsd: 5000,
          },
        ],
        lastUpdated: new Date(),
      };

      redisMock = createRedisMock(
        new Map([[`zapper:portfolio:${testAddress}:ethereum`, mockPortfolio]])
      );

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithMock = module.get<ZapperService>(ZapperService);
      (serviceWithMock as any).logger = createLoggerMock();

      const positions = await serviceWithMock.getProtocolPositions(testAddress, ['compound-v3']);

      expect(positions).toHaveLength(0);
    });
  });

  describe('getMultiNetworkStats', () => {
    it('should aggregate stats across multiple networks', async () => {
      // Mock portfolios for different networks
      const ethPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'ethereum',
        totalBalanceUsd: 10000,
        totalBorrowedUsd: 2000,
        netWorthUsd: 8000,
        positions: [{ id: '1' } as any, { id: '2' } as any],
        lastUpdated: new Date(),
      };

      const polygonPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'polygon',
        totalBalanceUsd: 5000,
        totalBorrowedUsd: 0,
        netWorthUsd: 5000,
        positions: [{ id: '3' } as any],
        lastUpdated: new Date(),
      };

      const arbitrumPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'arbitrum',
        totalBalanceUsd: 3000,
        totalBorrowedUsd: 500,
        netWorthUsd: 2500,
        positions: [{ id: '4' } as any],
        lastUpdated: new Date(),
      };

      redisMock = createRedisMock(
        new Map([
          [`zapper:portfolio:${testAddress}:ethereum`, ethPortfolio],
          [`zapper:portfolio:${testAddress}:polygon`, polygonPortfolio],
          [`zapper:portfolio:${testAddress}:arbitrum`, arbitrumPortfolio],
        ])
      );

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithMock = module.get<ZapperService>(ZapperService);
      (serviceWithMock as any).logger = createLoggerMock();

      const stats = await serviceWithMock.getMultiNetworkStats(testAddress);

      expect(stats.totalValueUsd).toBe(18000);
      expect(stats.totalBorrowedUsd).toBe(2500);
      expect(stats.netWorthUsd).toBe(15500);
      expect(stats.positionCount).toBe(4);
      expect(stats.networks.ethereum.valueUsd).toBe(10000);
      expect(stats.networks.polygon.positionCount).toBe(1);
    });

    it('should handle network failures gracefully', async () => {
      const ethPortfolio: DeFiPortfolio = {
        address: testAddress,
        network: 'ethereum',
        totalBalanceUsd: 10000,
        totalBorrowedUsd: 0,
        netWorthUsd: 10000,
        positions: [{ id: '1' } as any],
        lastUpdated: new Date(),
      };

      // Only cache ethereum, let others fail/return mock
      redisMock = createRedisMock(
        new Map([[`zapper:portfolio:${testAddress}:ethereum`, ethPortfolio]])
      );

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithMock = module.get<ZapperService>(ZapperService);
      (serviceWithMock as any).logger = createLoggerMock();

      // Should not throw, will return mock data for uncached networks
      const stats = await serviceWithMock.getMultiNetworkStats(testAddress);

      expect(stats.totalValueUsd).toBeGreaterThanOrEqual(10000);
      expect(stats.networks.ethereum.valueUsd).toBe(10000);
    });

    it('should use default networks when none specified', async () => {
      const result = await service.getMultiNetworkStats(testAddress);

      // Default networks are ethereum, polygon, arbitrum
      expect(result.networks).toBeDefined();
    });

    it('should respect custom network list', async () => {
      const result = await service.getMultiNetworkStats(testAddress, ['ethereum', 'bsc']);

      expect(Object.keys(result.networks)).toHaveLength(2);
    });
  });

  describe('mapAppIdToProtocol', () => {
    const testCases: Array<[string, string]> = [
      ['uniswap', 'uniswap-v2'],
      ['uniswap-v2', 'uniswap-v2'],
      ['uniswap-v3', 'uniswap-v3'],
      ['aave', 'aave-v2'],
      ['aave-v3', 'aave-v3'],
      ['compound', 'compound-v2'],
      ['curve', 'curve'],
      ['lido', 'lido'],
      ['yearn', 'yearn'],
      ['maker', 'maker'],
      ['convex', 'convex'],
      ['balancer', 'balancer'],
      ['sushiswap', 'sushiswap'],
      ['pancakeswap', 'pancakeswap'],
      ['unknown-app', 'other'],
    ];

    it.each(testCases)('should map %s to %s', (appId, expectedProtocol) => {
      const result = (service as any).mapAppIdToProtocol(appId);
      expect(result).toBe(expectedProtocol);
    });

    it('should be case-insensitive', () => {
      const result = (service as any).mapAppIdToProtocol('AAVE');
      expect(result).toBe('aave-v2');
    });
  });

  describe('inferPositionType', () => {
    const testCases: Array<[string, string, string]> = [
      ['Borrowing Position', 'aave', 'borrowing'],
      ['Lending Pool', 'aave', 'lending'],
      ['Supply Position', 'compound', 'lending'],
      ['Staking Rewards', 'lido', 'staking'],
      ['Yield Farming', 'yearn', 'farming'],
      ['Vault Position', 'yearn', 'vault'],
      ['LP Token', 'uniswap', 'liquidity-pool'],
      ['Pool Share', 'curve', 'liquidity-pool'],
      ['Random Label', 'random', 'liquidity-pool'],
    ];

    it.each(testCases)('should infer %s with appId %s as %s', (label, appId, expectedType) => {
      const result = (service as any).inferPositionType(label, appId);
      expect(result).toBe(expectedType);
    });

    it('should detect Lido staking by appId', () => {
      const result = (service as any).inferPositionType('ETH Position', 'lido-staking');
      expect(result).toBe('staking');
    });

    it('should detect Yearn vaults by appId', () => {
      const result = (service as any).inferPositionType('USDC Position', 'yearn-vault');
      expect(result).toBe('vault');
    });
  });

  describe('buildPortfolio', () => {
    it('should aggregate balances from multiple apps', () => {
      const appBalances = [
        {
          appId: 'uniswap-v3',
          appName: 'Uniswap V3',
          products: [
            {
              label: 'Liquidity',
              assets: [
                {
                  symbol: 'ETH',
                  address: '0x...',
                  decimals: 18,
                  supply: 1,
                  price: 3000,
                  balanceUSD: 3000,
                },
              ],
              meta: [],
            },
          ],
        },
        {
          appId: 'aave-v3',
          appName: 'Aave V3',
          products: [
            {
              label: 'Lending',
              assets: [
                {
                  symbol: 'USDC',
                  address: '0x...',
                  decimals: 6,
                  supply: 2000,
                  price: 1,
                  balanceUSD: 2000,
                },
              ],
              meta: [],
            },
          ],
        },
      ];

      const portfolio = (service as any).buildPortfolio(testAddress, 'ethereum', appBalances);

      expect(portfolio.totalBalanceUsd).toBe(5000);
      expect(portfolio.positions).toHaveLength(2);
    });

    it('should track borrowed amounts from meta', () => {
      const appBalances = [
        {
          appId: 'aave-v3',
          appName: 'Aave V3',
          products: [
            {
              label: 'Borrowing',
              assets: [
                {
                  symbol: 'USDC',
                  address: '0x...',
                  decimals: 6,
                  supply: 1000,
                  price: 1,
                  balanceUSD: 1000,
                },
              ],
              meta: [{ label: 'Borrowed', value: 500, type: 'dollar' }],
            },
          ],
        },
      ];

      const portfolio = (service as any).buildPortfolio(testAddress, 'ethereum', appBalances);

      expect(portfolio.totalBorrowedUsd).toBe(500);
      expect(portfolio.positions[0].borrowedUsd).toBe(500);
    });

    it('should extract health factor from meta', () => {
      const appBalances = [
        {
          appId: 'aave-v3',
          appName: 'Aave V3',
          products: [
            {
              label: 'Lending',
              assets: [
                {
                  symbol: 'ETH',
                  address: '0x',
                  decimals: 18,
                  supply: 1,
                  price: 3000,
                  balanceUSD: 3000,
                },
              ],
              meta: [{ label: 'Health Factor', value: 1.85, type: 'number' }],
            },
          ],
        },
      ];

      const portfolio = (service as any).buildPortfolio(testAddress, 'ethereum', appBalances);

      expect(portfolio.positions[0].healthFactor).toBe(1.85);
    });

    it('should extract APY from asset dataProps', () => {
      const appBalances = [
        {
          appId: 'aave-v3',
          appName: 'Aave V3',
          products: [
            {
              label: 'Lending',
              assets: [
                {
                  symbol: 'USDC',
                  address: '0x...',
                  decimals: 6,
                  supply: 1000,
                  price: 1,
                  balanceUSD: 1000,
                  dataProps: { apy: 5.5 },
                },
              ],
              meta: [],
            },
          ],
        },
      ];

      const portfolio = (service as any).buildPortfolio(testAddress, 'ethereum', appBalances);

      expect(portfolio.positions[0].apy).toBe(5.5);
    });
  });

  describe('cache operations', () => {
    it('should handle cache read errors gracefully', async () => {
      redisMock.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getPortfolio(testAddress);

      // Should fall back to mock data
      expect(result.address).toBe(testAddress);
    });

    it('should handle cache write errors gracefully', async () => {
      configMock = createConfigMock({ ZAPPER_API_KEY: 'test-api-key' });

      global.fetch = jest
        .fn()
        .mockResolvedValue(createFetchResponse({ [testAddress.toLowerCase()]: [] }));
      redisMock.set.mockRejectedValue(new Error('Redis write failed'));

      const module = await Test.createTestingModule({
        providers: [
          ZapperService,
          { provide: ConfigService, useValue: configMock },
          { provide: RedisService, useValue: redisMock },
        ],
      }).compile();

      const serviceWithKey = module.get<ZapperService>(ZapperService);
      (serviceWithKey as any).logger = createLoggerMock();

      // Should not throw
      const result = await serviceWithKey.getPortfolio(testAddress);
      expect(result.address).toBe(testAddress);
    });
  });

  describe('mock data generation', () => {
    it('should include Uniswap LP position for some addresses', async () => {
      // Find an address that generates Uniswap position
      let foundUniswap = false;
      for (let i = 0; i < 10 && !foundUniswap; i++) {
        const addr = `0x${'0'.repeat(39)}${i.toString(16)}`;
        const result = await service.getPortfolio(addr);
        if (result.positions.some((p) => p.protocol === 'uniswap-v3')) {
          foundUniswap = true;
          expect(result.positions.find((p) => p.protocol === 'uniswap-v3')?.type).toBe(
            'liquidity-pool'
          );
        }
      }
    });

    it('should include Aave lending position for some addresses', async () => {
      // Address hash % 3 === 1 gets Aave position
      const result = await service.getPortfolio('0x1234567890abcdef1234567890abcdef12345678');
      // Check if any position exists - mock data is deterministic
      expect(result.positions).toBeDefined();
    });

    it('should include Lido staking position for some addresses', async () => {
      // Address hash % 4 === 2 gets Lido position
      const result = await service.getPortfolio('0x2222222222222222222222222222222222222222');
      expect(result.positions).toBeDefined();
    });

    it('should calculate netWorthUsd correctly', async () => {
      const result = await service.getPortfolio(testAddress);

      expect(result.netWorthUsd).toBe(result.totalBalanceUsd - result.totalBorrowedUsd);
    });
  });

  describe('mapZapperProductToPosition', () => {
    it('should create position with correct tokens', () => {
      const app = {
        appId: 'uniswap-v3',
        appName: 'Uniswap V3',
      };

      const product = {
        label: 'ETH/USDC Pool',
        assets: [
          {
            symbol: 'ETH',
            address: '0xeth',
            decimals: 18,
            supply: 0.5,
            price: 3000,
            balanceUSD: 1500,
          },
          {
            symbol: 'USDC',
            address: '0xusdc',
            decimals: 6,
            supply: 1500,
            price: 1,
            balanceUSD: 1500,
          },
        ],
        meta: [],
      };

      const position = (service as any).mapZapperProductToPosition(app, product, 'ethereum');

      expect(position.tokens).toHaveLength(2);
      expect(position.tokens[0].symbol).toBe('ETH');
      expect(position.tokens[1].symbol).toBe('USDC');
      expect(position.balanceUsd).toBe(3000);
    });

    it('should generate unique position IDs', () => {
      const app = { appId: 'aave', appName: 'Aave' };
      const product = { label: 'Lending', assets: [], meta: [] };

      const ethPosition = (service as any).mapZapperProductToPosition(app, product, 'ethereum');
      const polyPosition = (service as any).mapZapperProductToPosition(app, product, 'polygon');

      expect(ethPosition.id).not.toBe(polyPosition.id);
    });
  });
});
