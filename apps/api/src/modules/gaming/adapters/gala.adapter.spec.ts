import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
} from '../../../../test/helpers/api-mock-factory';
import { RedisService } from '../../../core/redis/redis.service';

import { GalaAdapter } from './gala.adapter';

describe('GalaAdapter', () => {
  let adapter: GalaAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalaAdapter,
        { provide: ConfigService, useValue: createConfigMock() },
        { provide: RedisService, useValue: createRedisMock() },
      ],
    }).compile();

    adapter = module.get<GalaAdapter>(GalaAdapter);
    (adapter as any).logger = createLoggerMock();
  });

  it('should have correct platform metadata', () => {
    expect(adapter.platform).toBe('gala');
    expect(adapter.chain).toBe('galachain');
    expect(adapter.supportedTokens).toEqual(['GALA']);
  });

  it('should not be available (coming soon)', () => {
    expect(adapter.isAvailable()).toBe(false);
  });

  describe('getPositions', () => {
    it('should return empty positions', async () => {
      const result = await adapter.getPositions('space-1');

      expect(result.platform).toBe('gala');
      expect(result.chain).toBe('galachain');
      expect(result.totalValueUsd).toBe(0);
      expect(result.tokens).toEqual([]);
      expect(result.staking).toEqual([]);
      expect(result.land).toEqual([]);
      expect(result.nfts).toEqual([]);
      expect(result.earnings).toEqual([]);
    });
  });
});
