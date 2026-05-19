import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
} from '../../../test/helpers/api-mock-factory';
import { RedisService } from '../../core/redis/redis.service';

import { SandboxService } from './sandbox.service';

describe('SandboxService', () => {
  let service: SandboxService;
  let redisMock: ReturnType<typeof createRedisMock>;
  let configMock: ReturnType<typeof createConfigMock>;

  beforeEach(async () => {
    redisMock = createRedisMock();
    configMock = createConfigMock({ FEATURE_SANDBOX_MOCK_DATA: 'true' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SandboxService,
        { provide: ConfigService, useValue: configMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    service = module.get<SandboxService>(SandboxService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLandFloorPrice', () => {
    it('should return cached data on cache hit', async () => {
      const cached = {
        floorPriceUsd: 1450,
        floorPriceEth: 0.42,
        change24h: 3.2,
        totalListings: 2847,
        lastUpdated: '2026-01-01T00:00:00.000Z',
      };
      redisMock.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getLandFloorPrice();

      expect(result).toEqual(cached);
      expect(redisMock.get).toHaveBeenCalledWith('gaming:sandbox:land-floor-price');
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('should fetch and cache data on cache miss', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getLandFloorPrice();

      expect(result.floorPriceUsd).toBe(1450);
      expect(result.floorPriceEth).toBe(0.42);
      expect(result.lastUpdated).toBeInstanceOf(Date);
      expect(redisMock.set).toHaveBeenCalledWith(
        'gaming:sandbox:land-floor-price',
        expect.any(String),
        900
      );
    });

    it('should use 15 minute TTL', async () => {
      redisMock.get.mockResolvedValue(null);

      await service.getLandFloorPrice();

      expect(redisMock.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 900);
    });
  });

  describe('getStakingApy', () => {
    it('should return cached data on cache hit', async () => {
      const cached = {
        currentApy: 8.5,
        totalStakedSand: 450000000,
        rewardsDistributed24h: 104795,
        lastUpdated: '2026-01-01T00:00:00.000Z',
      };
      redisMock.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getStakingApy();

      expect(result).toEqual(cached);
      expect(redisMock.get).toHaveBeenCalledWith('gaming:sandbox:staking-apy');
    });

    it('should fetch and cache data on cache miss', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getStakingApy();

      expect(result.currentApy).toBe(8.5);
      expect(result.totalStakedSand).toBe(450_000_000);
      expect(redisMock.set).toHaveBeenCalled();
    });
  });

  describe('getGamingPositions', () => {
    it('should return cached positions on cache hit', async () => {
      const cached = {
        totalGamingAssetsUsd: 50000,
        sandStaked: 15000,
        positions: [],
      };
      redisMock.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getGamingPositions('space-1');

      expect(result).toEqual(cached);
      expect(redisMock.get).toHaveBeenCalledWith('gaming:positions:space-1');
    });

    it('should aggregate positions on cache miss', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getGamingPositions('space-1');

      expect(result.sandStaked).toBe(15000);
      expect(result.sandStakingApy).toBe(8.5);
      expect(result.activeLandParcels).toBe(5);
      expect(result.nftCount).toBe(14);
      expect(result.positions).toHaveLength(3);
      expect(result.positions[0].type).toBe('staking');
      expect(result.positions[1].type).toBe('land');
      expect(result.positions[2].type).toBe('nft');
    });

    it('should calculate monthly staking reward correctly', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getGamingPositions('space-1');

      // monthlyStakingReward = (15000 * (8.5 / 100)) / 12 = 106.25
      expect(result.monthlyStakingReward).toBeCloseTo(106.25, 1);
    });

    it('should cache aggregated positions', async () => {
      redisMock.get.mockResolvedValue(null);

      await service.getGamingPositions('space-1');

      expect(redisMock.set).toHaveBeenCalledWith(
        'gaming:positions:space-1',
        expect.any(String),
        900
      );
    });

    it('should return empty positions when mock data is disabled', async () => {
      configMock.get.mockImplementation((key: string, defaultValue?: string) =>
        key === 'FEATURE_SANDBOX_MOCK_DATA' ? 'false' : defaultValue
      );
      redisMock.get.mockResolvedValue(null);

      const result = await service.getGamingPositions('space-1');

      expect(result.totalGamingAssetsUsd).toBe(0);
      expect(result.positions).toEqual([]);
    });

    it('should compute total gaming assets as sum of positions', async () => {
      redisMock.get.mockResolvedValue(null);

      const result = await service.getGamingPositions('space-1');

      const positionSum = result.positions.reduce((s, p) => s + p.valueUsd, 0);
      expect(result.totalGamingAssetsUsd).toBe(positionSum);
    });
  });
});
