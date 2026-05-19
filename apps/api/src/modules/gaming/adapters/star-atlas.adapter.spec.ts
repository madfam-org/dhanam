import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
} from '../../../../test/helpers/api-mock-factory';
import { RedisService } from '../../../core/redis/redis.service';

import { StarAtlasAdapter } from './star-atlas.adapter';

describe('StarAtlasAdapter', () => {
  let adapter: StarAtlasAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StarAtlasAdapter,
        { provide: ConfigService, useValue: createConfigMock() },
        { provide: RedisService, useValue: createRedisMock() },
      ],
    }).compile();

    adapter = module.get<StarAtlasAdapter>(StarAtlasAdapter);
    (adapter as any).logger = createLoggerMock();
  });

  it('should have correct platform metadata', () => {
    expect(adapter.platform).toBe('star-atlas');
    expect(adapter.chain).toBe('solana');
    expect(adapter.supportedTokens).toEqual(['ATLAS', 'POLIS']);
  });

  it('should not be available (coming soon)', () => {
    expect(adapter.isAvailable()).toBe(false);
  });

  describe('getPositions', () => {
    it('should return empty positions', async () => {
      const result = await adapter.getPositions('space-1');

      expect(result.platform).toBe('star-atlas');
      expect(result.chain).toBe('solana');
      expect(result.totalValueUsd).toBe(0);
      expect(result.tokens).toEqual([]);
      expect(result.staking).toEqual([]);
      expect(result.land).toEqual([]);
      expect(result.nfts).toEqual([]);
      expect(result.earnings).toEqual([]);
    });
  });
});
