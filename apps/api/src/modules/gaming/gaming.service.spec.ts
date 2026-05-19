import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
} from '../../../test/helpers/api-mock-factory';
import { RedisService } from '../../core/redis/redis.service';

import { AxieAdapter } from './adapters/axie.adapter';
import { EnjinAdapter } from './adapters/enjin.adapter';
import { GalaAdapter } from './adapters/gala.adapter';
import { IlluviumAdapter } from './adapters/illuvium.adapter';
import { ImmutableAdapter } from './adapters/immutable.adapter';
import { SandboxAdapter } from './adapters/sandbox.adapter';
import { StarAtlasAdapter } from './adapters/star-atlas.adapter';
import { GamingService } from './gaming.service';
import { MetaversePosition } from './interfaces/platform.interface';

const makeMockPosition = (
  platform: string,
  totalValueUsd: number,
  nfts: any[] = [],
  earnings: any[] = []
): MetaversePosition => ({
  platform: platform as any,
  chain: 'ethereum' as any,
  totalValueUsd,
  tokens: [],
  staking: [],
  land: [],
  nfts,
  earnings,
});

describe('GamingService', () => {
  let service: GamingService;
  let redisMock: ReturnType<typeof createRedisMock>;
  let sandboxAdapter: jest.Mocked<SandboxAdapter>;
  let axieAdapter: jest.Mocked<AxieAdapter>;
  let illuviumAdapter: jest.Mocked<IlluviumAdapter>;
  let starAtlasAdapter: jest.Mocked<StarAtlasAdapter>;
  let galaAdapter: jest.Mocked<GalaAdapter>;
  let enjinAdapter: jest.Mocked<EnjinAdapter>;
  let immutableAdapter: jest.Mocked<ImmutableAdapter>;

  const createAdapterMock = (platform: string, chain: string, tokens: string[]) => ({
    platform,
    chain,
    supportedTokens: tokens,
    isAvailable: jest.fn().mockReturnValue(true),
    getPositions: jest.fn(),
  });

  beforeEach(async () => {
    redisMock = createRedisMock();

    sandboxAdapter = createAdapterMock('sandbox', 'polygon', ['SAND']) as any;
    axieAdapter = createAdapterMock('axie', 'ronin', ['AXS', 'SLP']) as any;
    illuviumAdapter = createAdapterMock('illuvium', 'immutable-zkevm', ['ILV']) as any;
    starAtlasAdapter = createAdapterMock('star-atlas', 'solana', ['ATLAS', 'POLIS']) as any;
    galaAdapter = createAdapterMock('gala', 'galachain', ['GALA']) as any;
    enjinAdapter = createAdapterMock('enjin', 'ethereum', ['ENJ']) as any;
    immutableAdapter = createAdapterMock('immutable', 'immutable-zkevm', ['IMX']) as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamingService,
        { provide: ConfigService, useValue: createConfigMock() },
        { provide: RedisService, useValue: redisMock },
        { provide: SandboxAdapter, useValue: sandboxAdapter },
        { provide: AxieAdapter, useValue: axieAdapter },
        { provide: IlluviumAdapter, useValue: illuviumAdapter },
        { provide: StarAtlasAdapter, useValue: starAtlasAdapter },
        { provide: GalaAdapter, useValue: galaAdapter },
        { provide: EnjinAdapter, useValue: enjinAdapter },
        { provide: ImmutableAdapter, useValue: immutableAdapter },
      ],
    }).compile();

    service = module.get<GamingService>(GamingService);
    (service as any).logger = createLoggerMock();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAggregatedPortfolio', () => {
    it('should return cached portfolio on cache hit', async () => {
      const cached = { totalValueUsd: 10000, positions: [] };
      redisMock.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getAggregatedPortfolio('space-1');

      expect(result).toEqual(cached);
      expect(sandboxAdapter.getPositions).not.toHaveBeenCalled();
    });

    it('should aggregate positions on cache miss', async () => {
      redisMock.get.mockResolvedValue(null);

      sandboxAdapter.getPositions.mockResolvedValue(makeMockPosition('sandbox', 5000));
      axieAdapter.getPositions.mockResolvedValue(makeMockPosition('axie', 3000));
      illuviumAdapter.getPositions.mockResolvedValue(makeMockPosition('illuvium', 2000));
      starAtlasAdapter.getPositions.mockResolvedValue(makeMockPosition('star-atlas', 1000));
      galaAdapter.getPositions.mockResolvedValue(makeMockPosition('gala', 500));
      enjinAdapter.getPositions.mockResolvedValue(makeMockPosition('enjin', 200));
      immutableAdapter.getPositions.mockResolvedValue(makeMockPosition('immutable', 100));

      const result = await service.getAggregatedPortfolio('space-1');

      expect(result.totalValueUsd).toBe(11800);
      expect(result.platformsConnected).toBe(7);
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should handle partial adapter failures gracefully', async () => {
      redisMock.get.mockResolvedValue(null);

      sandboxAdapter.getPositions.mockResolvedValue(makeMockPosition('sandbox', 5000));
      axieAdapter.getPositions.mockRejectedValue(new Error('API down'));
      illuviumAdapter.getPositions.mockRejectedValue(new Error('Timeout'));
      starAtlasAdapter.getPositions.mockResolvedValue(makeMockPosition('star-atlas', 1000));
      galaAdapter.getPositions.mockRejectedValue(new Error('Rate limited'));
      enjinAdapter.getPositions.mockResolvedValue(makeMockPosition('enjin', 200));
      immutableAdapter.getPositions.mockResolvedValue(makeMockPosition('immutable', 100));

      const result = await service.getAggregatedPortfolio('space-1');

      // Only successful ones with value > 0
      expect(result.totalValueUsd).toBe(6300);
      expect(result.platformsConnected).toBe(4);
    });

    it('should filter out zero-value positions', async () => {
      redisMock.get.mockResolvedValue(null);

      sandboxAdapter.getPositions.mockResolvedValue(makeMockPosition('sandbox', 5000));
      axieAdapter.getPositions.mockResolvedValue(makeMockPosition('axie', 0));
      illuviumAdapter.getPositions.mockResolvedValue(makeMockPosition('illuvium', 0));
      starAtlasAdapter.getPositions.mockResolvedValue(makeMockPosition('star-atlas', 0));
      galaAdapter.getPositions.mockResolvedValue(makeMockPosition('gala', 0));
      enjinAdapter.getPositions.mockResolvedValue(makeMockPosition('enjin', 0));
      immutableAdapter.getPositions.mockResolvedValue(makeMockPosition('immutable', 0));

      const result = await service.getAggregatedPortfolio('space-1');

      expect(result.platformsConnected).toBe(1);
      expect(result.totalValueUsd).toBe(5000);
    });

    it('should return empty portfolio when all adapters fail', async () => {
      redisMock.get.mockResolvedValue(null);

      const error = new Error('API down');
      sandboxAdapter.getPositions.mockRejectedValue(error);
      axieAdapter.getPositions.mockRejectedValue(error);
      illuviumAdapter.getPositions.mockRejectedValue(error);
      starAtlasAdapter.getPositions.mockRejectedValue(error);
      galaAdapter.getPositions.mockRejectedValue(error);
      enjinAdapter.getPositions.mockRejectedValue(error);
      immutableAdapter.getPositions.mockRejectedValue(error);

      const result = await service.getAggregatedPortfolio('space-1');

      expect(result.totalValueUsd).toBe(0);
      expect(result.platformsConnected).toBe(0);
    });
  });

  describe('getPlatformPositions', () => {
    it('should return positions for known platform', async () => {
      const pos = makeMockPosition('sandbox', 5000);
      sandboxAdapter.getPositions.mockResolvedValue(pos);

      const result = await service.getPlatformPositions('sandbox', 'space-1');

      expect(result).toEqual(pos);
      expect(sandboxAdapter.getPositions).toHaveBeenCalledWith('space-1');
    });

    it('should return empty position for unknown platform', async () => {
      const result = await service.getPlatformPositions('decentraland', 'space-1');

      expect(result.totalValueUsd).toBe(0);
      expect(result.tokens).toEqual([]);
      expect(result.platform).toBe('decentraland');
    });
  });

  describe('getSupportedPlatforms', () => {
    it('should return all 7 adapters metadata', () => {
      const platforms = service.getSupportedPlatforms();

      expect(platforms).toHaveLength(7);
      expect(platforms.map((p) => p.platform)).toEqual(
        expect.arrayContaining([
          'sandbox',
          'axie',
          'illuvium',
          'star-atlas',
          'gala',
          'enjin',
          'immutable',
        ])
      );
    });

    it('should include chain, tokens, and available for each platform', () => {
      const platforms = service.getSupportedPlatforms();

      for (const p of platforms) {
        expect(p.chain).toBeDefined();
        expect(p.tokens.length).toBeGreaterThan(0);
        expect(typeof p.available).toBe('boolean');
      }
    });
  });

  describe('getEarnings', () => {
    it('should return earnings breakdown', async () => {
      const earnings = [
        {
          source: 'staking' as const,
          platform: 'sandbox' as any,
          monthlyAmountUsd: 48,
          token: 'SAND',
        },
        {
          source: 'rental' as const,
          platform: 'sandbox' as any,
          monthlyAmountUsd: 135,
          token: 'SAND',
        },
      ];
      redisMock.get.mockResolvedValue(null);

      sandboxAdapter.getPositions.mockResolvedValue({
        ...makeMockPosition('sandbox', 5000),
        earnings,
      });
      axieAdapter.getPositions.mockResolvedValue(makeMockPosition('axie', 0));
      illuviumAdapter.getPositions.mockResolvedValue(makeMockPosition('illuvium', 0));
      starAtlasAdapter.getPositions.mockResolvedValue(makeMockPosition('star-atlas', 0));
      galaAdapter.getPositions.mockResolvedValue(makeMockPosition('gala', 0));
      enjinAdapter.getPositions.mockResolvedValue(makeMockPosition('enjin', 0));
      immutableAdapter.getPositions.mockResolvedValue(makeMockPosition('immutable', 0));

      const result = await service.getEarnings('space-1');

      expect(result.totalMonthlyUsd).toBe(183);
      expect(result.streams).toHaveLength(2);
    });
  });

  describe('getNftInventory', () => {
    it('should extract NFTs from all positions', async () => {
      const nfts = [
        {
          id: 'nft-1',
          name: 'NFT 1',
          collection: 'Col1',
          platform: 'sandbox' as any,
          chain: 'polygon' as any,
          currentValueUsd: 500,
          acquisitionCostUsd: 300,
        },
      ];
      redisMock.get.mockResolvedValue(null);

      sandboxAdapter.getPositions.mockResolvedValue({
        ...makeMockPosition('sandbox', 5000, nfts),
      });
      axieAdapter.getPositions.mockResolvedValue(makeMockPosition('axie', 0));
      illuviumAdapter.getPositions.mockResolvedValue(makeMockPosition('illuvium', 0));
      starAtlasAdapter.getPositions.mockResolvedValue(makeMockPosition('star-atlas', 0));
      galaAdapter.getPositions.mockResolvedValue(makeMockPosition('gala', 0));
      enjinAdapter.getPositions.mockResolvedValue(makeMockPosition('enjin', 0));
      immutableAdapter.getPositions.mockResolvedValue(makeMockPosition('immutable', 0));

      const result = await service.getNftInventory('space-1');

      expect(result.totalCount).toBe(1);
      expect(result.totalValueUsd).toBe(500);
      expect(result.items[0].name).toBe('NFT 1');
    });
  });
});
