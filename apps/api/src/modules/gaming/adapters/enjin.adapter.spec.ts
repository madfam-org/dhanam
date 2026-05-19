import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
} from '../../../../test/helpers/api-mock-factory';
import { RedisService } from '../../../core/redis/redis.service';

import { EnjinAdapter } from './enjin.adapter';

describe('EnjinAdapter', () => {
  let adapter: EnjinAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnjinAdapter,
        { provide: ConfigService, useValue: createConfigMock() },
        { provide: RedisService, useValue: createRedisMock() },
      ],
    }).compile();

    adapter = module.get<EnjinAdapter>(EnjinAdapter);
    (adapter as any).logger = createLoggerMock();
  });

  it('should have correct platform metadata', () => {
    expect(adapter.platform).toBe('enjin');
    expect(adapter.chain).toBe('ethereum');
    expect(adapter.supportedTokens).toEqual(['ENJ']);
  });

  it('should not be available (coming soon)', () => {
    expect(adapter.isAvailable()).toBe(false);
  });

  describe('getPositions', () => {
    it('should return empty positions', async () => {
      const result = await adapter.getPositions('space-1');

      expect(result.platform).toBe('enjin');
      expect(result.chain).toBe('ethereum');
      expect(result.totalValueUsd).toBe(0);
      expect(result.tokens).toEqual([]);
      expect(result.staking).toEqual([]);
      expect(result.land).toEqual([]);
      expect(result.nfts).toEqual([]);
      expect(result.earnings).toEqual([]);
    });
  });
});
