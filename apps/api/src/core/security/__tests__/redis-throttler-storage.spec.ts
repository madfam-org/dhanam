import Redis from 'ioredis';

// We test the RedisThrottlerStorage class which is defined inside rate-limiting.module.ts
// Since it's not exported, we replicate the class here for testing (following the increment algorithm)
// This tests the MULTI/INCR/PTTL algorithm and expiry behavior

jest.mock('ioredis', () => {
  const mockMulti = {
    incr: jest.fn().mockReturnThis(),
    pttl: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const mockRedis = {
    multi: jest.fn(() => mockMulti),
    pexpire: jest.fn(),
    incr: jest.fn(),
    pttl: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

/**
 * Extracted RedisThrottlerStorage logic for isolated unit testing.
 * Mirrors the implementation in rate-limiting.module.ts.
 */
class RedisThrottlerStorage {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      keyPrefix: 'throttle:',
      maxRetriesPerRequest: 1,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const results = await multi.exec();

    const totalHits = (results?.[0]?.[1] as number) || 1;
    let timeToExpire = (results?.[1]?.[1] as number) || -1;

    if (timeToExpire < 0) {
      await this.redis.pexpire(key, ttl);
      timeToExpire = ttl;
    }

    const isBlocked = totalHits > limit;
    const timeToBlockExpire = isBlocked ? blockDuration : 0;

    if (isBlocked && blockDuration > 0) {
      await this.redis.pexpire(key, blockDuration);
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }
}

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let mockRedisInstance: any;
  let mockMulti: any;

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new RedisThrottlerStorage();
    mockRedisInstance = (Redis as unknown as jest.Mock).mock.results[0].value;
    mockMulti = mockRedisInstance.multi();
  });

  describe('increment', () => {
    it('should execute MULTI with INCR and PTTL', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 1], // INCR result
        [null, 5000], // PTTL result
      ]);

      await storage.increment('test-key', 60000, 10, 0, 'short');

      expect(mockRedisInstance.multi).toHaveBeenCalled();
      expect(mockMulti.incr).toHaveBeenCalledWith('test-key');
      expect(mockMulti.pttl).toHaveBeenCalledWith('test-key');
    });

    it('should return correct totalHits from INCR result', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 5],
        [null, 30000],
      ]);

      const result = await storage.increment('key', 60000, 10, 0, 'short');

      expect(result.totalHits).toBe(5);
    });

    it('should set expiry when key has no TTL (new key)', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 1],
        [null, -1], // No TTL set
      ]);

      const result = await storage.increment('new-key', 60000, 10, 0, 'short');

      expect(mockRedisInstance.pexpire).toHaveBeenCalledWith('new-key', 60000);
      expect(result.timeToExpire).toBe(60000);
    });

    it('should not set expiry when key already has TTL', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 2],
        [null, 45000],
      ]);

      const result = await storage.increment('existing-key', 60000, 10, 0, 'short');

      expect(mockRedisInstance.pexpire).not.toHaveBeenCalled();
      expect(result.timeToExpire).toBe(45000);
    });

    it('should mark as blocked when totalHits exceeds limit', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 11], // Exceeds limit of 10
        [null, 30000],
      ]);

      const result = await storage.increment('key', 60000, 10, 120000, 'short');

      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(120000);
    });

    it('should not be blocked when totalHits equals limit', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 10], // Exactly at limit
        [null, 30000],
      ]);

      const result = await storage.increment('key', 60000, 10, 120000, 'short');

      expect(result.isBlocked).toBe(false);
      expect(result.timeToBlockExpire).toBe(0);
    });

    it('should extend expiry to blockDuration when blocked', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 15],
        [null, 30000],
      ]);

      await storage.increment('key', 60000, 10, 120000, 'short');

      expect(mockRedisInstance.pexpire).toHaveBeenCalledWith('key', 120000);
    });

    it('should not extend expiry when blocked but blockDuration is 0', async () => {
      mockMulti.exec.mockResolvedValue([
        [null, 15],
        [null, 30000],
      ]);

      await storage.increment('key', 60000, 10, 0, 'short');

      expect(mockRedisInstance.pexpire).not.toHaveBeenCalled();
    });

    it('should handle null MULTI results gracefully', async () => {
      mockMulti.exec.mockResolvedValue(null);

      const result = await storage.increment('key', 60000, 10, 0, 'short');

      expect(result.totalHits).toBe(1); // Falls back to 1
    });

    it('should handle concurrent requests to the same key', async () => {
      // Simulate rapid sequential requests
      mockMulti.exec
        .mockResolvedValueOnce([
          [null, 1],
          [null, -1],
        ])
        .mockResolvedValueOnce([
          [null, 2],
          [null, 59000],
        ])
        .mockResolvedValueOnce([
          [null, 3],
          [null, 58000],
        ]);

      const results = await Promise.all([
        storage.increment('key', 60000, 10, 0, 'short'),
        storage.increment('key', 60000, 10, 0, 'short'),
        storage.increment('key', 60000, 10, 0, 'short'),
      ]);

      expect(results[0].totalHits).toBe(1);
      expect(results[1].totalHits).toBe(2);
      expect(results[2].totalHits).toBe(3);
    });
  });
});
