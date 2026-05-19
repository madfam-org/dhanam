import Redis from 'ioredis';

import { RedisService } from '../redis.service';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    hget: jest.fn(),
    hset: jest.fn(),
    hgetall: jest.fn(),
    ping: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisInstance: jest.Mocked<Redis>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';

    service = new RedisService();
    // Get the mock instance that was created by the constructor
    mockRedisInstance = (Redis as unknown as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should connect via REDIS_URL when available', () => {
      jest.clearAllMocks();
      process.env.REDIS_URL = 'redis://myhost:6380/1';

      new RedisService();

      expect(Redis).toHaveBeenCalledWith(
        'redis://myhost:6380/1',
        expect.objectContaining({
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 10000,
        })
      );
    });

    it('should connect via individual env vars when REDIS_URL is not set', () => {
      // Already constructed in beforeEach without REDIS_URL
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        })
      );
    });

    it('should register error and connect event handlers', () => {
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });
  });

  describe('get', () => {
    it('should return value for existing key', async () => {
      mockRedisInstance.get.mockResolvedValue('some-value');

      const result = await service.get('my-key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('my-key');
      expect(result).toBe('some-value');
    });

    it('should return null for non-existent key', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await service.get('missing-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      const result = await service.set('key', 'value');

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value');
      expect(result).toBe('OK');
    });

    it('should set value with TTL in seconds', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      const result = await service.set('key', 'value', 3600);

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value', 'EX', 3600);
      expect(result).toBe('OK');
    });

    it('should not use EX when ttl is 0 (falsy)', async () => {
      mockRedisInstance.set.mockResolvedValue('OK');

      await service.set('key', 'value', 0);

      expect(mockRedisInstance.set).toHaveBeenCalledWith('key', 'value');
    });
  });

  describe('hget', () => {
    it('should return hash field value', async () => {
      mockRedisInstance.hget.mockResolvedValue('field-value');

      const result = await service.hget('hash-key', 'field');

      expect(mockRedisInstance.hget).toHaveBeenCalledWith('hash-key', 'field');
      expect(result).toBe('field-value');
    });

    it('should return null for missing hash field', async () => {
      mockRedisInstance.hget.mockResolvedValue(null);

      const result = await service.hget('hash-key', 'missing');

      expect(result).toBeNull();
    });
  });

  describe('hset', () => {
    it('should set hash field value', async () => {
      mockRedisInstance.hset.mockResolvedValue(1);

      const result = await service.hset('hash-key', 'field', 'value');

      expect(mockRedisInstance.hset).toHaveBeenCalledWith('hash-key', 'field', 'value');
      expect(result).toBe(1);
    });
  });

  describe('hgetall', () => {
    it('should return all hash fields', async () => {
      const mockData = { field1: 'value1', field2: 'value2' };
      mockRedisInstance.hgetall.mockResolvedValue(mockData);

      const result = await service.hgetall('hash-key');

      expect(result).toEqual(mockData);
    });
  });

  describe('ping', () => {
    it('should return true when Redis responds with PONG', async () => {
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const result = await service.ping();

      expect(result).toBe(true);
    });

    it('should return false when Redis does not respond with PONG', async () => {
      mockRedisInstance.ping.mockResolvedValue('ERROR');

      const result = await service.ping();

      expect(result).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return the underlying Redis client', () => {
      const client = service.getClient();

      expect(client).toBeDefined();
      expect(client).toBe(mockRedisInstance);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Redis', async () => {
      mockRedisInstance.disconnect.mockResolvedValue(undefined as any);

      await service.onModuleDestroy();

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });
  });
});
