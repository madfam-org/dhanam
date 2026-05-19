import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import {
  createRedisMock,
  createConfigMock,
  createLoggerMock,
} from '../../../../test/helpers/api-mock-factory';
import { RedisService } from '../../../core/redis/redis.service';

import { ImmutableAdapter } from './immutable.adapter';

describe('ImmutableAdapter', () => {
  let adapter: ImmutableAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImmutableAdapter,
        { provide: ConfigService, useValue: createConfigMock() },
        { provide: RedisService, useValue: createRedisMock() },
      ],
    }).compile();

    adapter = module.get<ImmutableAdapter>(ImmutableAdapter);
    (adapter as any).logger = createLoggerMock();
  });

  it('should have correct platform metadata', () => {
    expect(adapter.platform).toBe('immutable');
    expect(adapter.chain).toBe('immutable-zkevm');
    expect(adapter.supportedTokens).toEqual(['IMX']);
  });

  it('should not be available (coming soon)', () => {
    expect(adapter.isAvailable()).toBe(false);
  });

  describe('getPositions', () => {
    it('should return empty positions', async () => {
      const result = await adapter.getPositions('space-1');

      expect(result.platform).toBe('immutable');
      expect(result.chain).toBe('immutable-zkevm');
      expect(result.totalValueUsd).toBe(0);
      expect(result.tokens).toEqual([]);
      expect(result.staking).toEqual([]);
      expect(result.land).toEqual([]);
      expect(result.nfts).toEqual([]);
      expect(result.earnings).toEqual([]);
    });
  });
});
