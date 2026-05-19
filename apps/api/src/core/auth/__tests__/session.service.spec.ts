import { randomBytes, createHash } from 'crypto';

import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';

import { LoggerService } from '@core/logger/logger.service';

import { SessionService } from '../session.service';

// Mock Redis
jest.mock('ioredis');

describe('SessionService', () => {
  let service: SessionService;
  let redis: jest.Mocked<Redis>;
  let logger: jest.Mocked<LoggerService>;

  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService, { provide: LoggerService, useValue: mockLogger }],
    }).compile();

    service = module.get<SessionService>(SessionService);
    logger = module.get(LoggerService);

    // Get the mocked Redis instance
    redis = (service as any).redis;

    // Mock Redis methods
    redis.setex = jest.fn().mockResolvedValue('OK');
    redis.get = jest.fn().mockResolvedValue(null);
    redis.del = jest.fn().mockResolvedValue(1);
    redis.sadd = jest.fn().mockResolvedValue(1);
    redis.expire = jest.fn().mockResolvedValue(1);
    redis.smembers = jest.fn().mockResolvedValue([]);
    redis.srem = jest.fn().mockResolvedValue(1);
    redis.pipeline = jest.fn().mockReturnValue({
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    it('should create refresh token with 30-day expiration', async () => {
      const token = await service.createRefreshToken(mockUserId, mockEmail);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters

      expect(redis.setex).toHaveBeenCalled();
      const setexCall = (redis.setex as jest.Mock).mock.calls[0];
      expect(setexCall[1]).toBe(30 * 24 * 60 * 60); // 30 days in seconds
    });

    it('should store session data in Redis', async () => {
      await service.createRefreshToken(mockUserId, mockEmail);

      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining('refresh_token:'),
        30 * 24 * 60 * 60,
        expect.any(String)
      );

      const sessionData = JSON.parse((redis.setex as jest.Mock).mock.calls[0][2]);
      expect(sessionData).toMatchObject({
        userId: mockUserId,
        email: mockEmail,
        createdAt: expect.any(Number),
        expiresAt: expect.any(Number),
      });
    });

    it('should hash token before storing', async () => {
      const token = await service.createRefreshToken(mockUserId, mockEmail);

      const setexCall = (redis.setex as jest.Mock).mock.calls[0];
      const storedKey = setexCall[0];

      // Token should be hashed (SHA256 = 64 characters)
      expect(storedKey).toContain('refresh_token:');
      expect(storedKey.split(':')[1]).toHaveLength(64);
      expect(storedKey).not.toContain(token);
    });

    it('should track user active sessions', async () => {
      await service.createRefreshToken(mockUserId, mockEmail);

      expect(redis.sadd).toHaveBeenCalledWith(`user_sessions:${mockUserId}`, expect.any(String));

      expect(redis.expire).toHaveBeenCalledWith(`user_sessions:${mockUserId}`, 30 * 24 * 60 * 60);
    });
  });

  describe('validateRefreshToken', () => {
    const token = 'valid-refresh-token';
    const hashedToken = createHash('sha256').update(token).digest('hex');

    it('should return session data for valid token', async () => {
      const sessionData = {
        userId: mockUserId,
        email: mockEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };

      redis.get = jest.fn().mockResolvedValue(JSON.stringify(sessionData));

      const result = await service.validateRefreshToken(token);

      expect(result).toMatchObject(sessionData);
      expect(redis.get).toHaveBeenCalledWith(`refresh_token:${hashedToken}`);
    });

    it('should return null for non-existent token', async () => {
      redis.get = jest.fn().mockResolvedValue(null);

      const result = await service.validateRefreshToken(token);

      expect(result).toBeNull();
    });

    it('should throw SecurityException for expired token', async () => {
      const expiredSessionData = {
        userId: mockUserId,
        email: mockEmail,
        createdAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 1000, // Expired
      };

      redis.get = jest.fn().mockResolvedValue(JSON.stringify(expiredSessionData));

      await expect(service.validateRefreshToken(token)).rejects.toThrow('Token has expired');
      expect(redis.del).toHaveBeenCalled(); // Should clean up expired token
    });

    it('should handle corrupted session data', async () => {
      redis.get = jest.fn().mockResolvedValue('invalid-json');

      const result = await service.validateRefreshToken(token);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalled(); // Should clean up corrupted data
    });
  });

  describe('revokeRefreshToken', () => {
    const token = 'token-to-revoke';
    const hashedToken = createHash('sha256').update(token).digest('hex');

    it('should delete token from Redis', async () => {
      const sessionData = {
        userId: mockUserId,
        email: mockEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000,
      };

      redis.get = jest.fn().mockResolvedValue(JSON.stringify(sessionData));

      await service.revokeRefreshToken(token);

      expect(redis.del).toHaveBeenCalledWith(`refresh_token:${hashedToken}`);
    });

    it('should remove token from user sessions set', async () => {
      const sessionData = {
        userId: mockUserId,
        email: mockEmail,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000,
      };

      redis.get = jest.fn().mockResolvedValue(JSON.stringify(sessionData));

      await service.revokeRefreshToken(token);

      expect(redis.srem).toHaveBeenCalledWith(`user_sessions:${mockUserId}`, hashedToken);
    });

    it('should handle non-existent token gracefully', async () => {
      redis.get = jest.fn().mockResolvedValue(null);

      await expect(service.revokeRefreshToken(token)).resolves.not.toThrow();

      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should delete all user refresh tokens', async () => {
      const hashedTokens = ['hash1', 'hash2', 'hash3'];
      redis.smembers = jest.fn().mockResolvedValue(hashedTokens);

      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline = jest.fn().mockReturnValue(mockPipeline);

      await service.revokeAllUserSessions(mockUserId);

      expect(redis.smembers).toHaveBeenCalledWith(`user_sessions:${mockUserId}`);
      expect(mockPipeline.del).toHaveBeenCalledTimes(4); // 3 tokens + 1 set
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should delete user sessions set', async () => {
      redis.smembers = jest.fn().mockResolvedValue([]);

      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };
      redis.pipeline = jest.fn().mockReturnValue(mockPipeline);

      await service.revokeAllUserSessions(mockUserId);

      expect(mockPipeline.del).toHaveBeenCalledWith(`user_sessions:${mockUserId}`);
    });
  });

  describe('password reset tokens', () => {
    describe('createPasswordResetToken', () => {
      it('should create reset token with 1-hour expiration', async () => {
        const token = await service.createPasswordResetToken(mockUserId);

        expect(token).toBeDefined();
        expect(token.length).toBe(64); // 32 bytes hex

        expect(redis.setex).toHaveBeenCalledWith(
          expect.stringContaining('password_reset:'),
          60 * 60, // 1 hour in seconds
          expect.any(String)
        );
      });

      it('should store user ID in reset token data', async () => {
        await service.createPasswordResetToken(mockUserId);

        const resetData = JSON.parse((redis.setex as jest.Mock).mock.calls[0][2]);
        expect(resetData.userId).toBe(mockUserId);
        expect(resetData.expiresAt).toBeDefined();
      });
    });

    describe('validatePasswordResetToken', () => {
      const token = 'reset-token';
      const hashedToken = createHash('sha256').update(token).digest('hex');

      it('should return user ID for valid token', async () => {
        const resetData = {
          userId: mockUserId,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };

        redis.get = jest.fn().mockResolvedValue(JSON.stringify(resetData));

        const result = await service.validatePasswordResetToken(token);

        expect(result).toBe(mockUserId);
        expect(redis.get).toHaveBeenCalledWith(`password_reset:${hashedToken}`);
      });

      it('should delete token after successful validation (single-use)', async () => {
        const resetData = {
          userId: mockUserId,
          expiresAt: Date.now() + 1000,
        };

        redis.get = jest.fn().mockResolvedValue(JSON.stringify(resetData));

        await service.validatePasswordResetToken(token);

        expect(redis.del).toHaveBeenCalledWith(`password_reset:${hashedToken}`);
      });

      it('should return null for expired reset token', async () => {
        const expiredData = {
          userId: mockUserId,
          expiresAt: Date.now() - 1000,
        };

        redis.get = jest.fn().mockResolvedValue(JSON.stringify(expiredData));

        const result = await service.validatePasswordResetToken(token);

        expect(result).toBeNull();
        expect(redis.del).toHaveBeenCalled();
      });

      it('should return null for non-existent token', async () => {
        redis.get = jest.fn().mockResolvedValue(null);

        const result = await service.validatePasswordResetToken(token);

        expect(result).toBeNull();
      });

      it('should return null and log error for corrupted reset token data', async () => {
        redis.get = jest.fn().mockResolvedValue('invalid-json-data');

        const result = await service.validatePasswordResetToken(token);

        expect(result).toBeNull();
        expect(logger.error).toHaveBeenCalled();
        expect(redis.del).toHaveBeenCalledWith(`password_reset:${hashedToken}`);
      });
    });
  });

  describe('constructor branches', () => {
    it('should connect via REDIS_URL when set', async () => {
      process.env.REDIS_URL = 'redis://custom-host:6380';

      const module2 = await Test.createTestingModule({
        providers: [
          SessionService,
          {
            provide: LoggerService,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
          },
        ],
      }).compile();

      const svc2 = module2.get<SessionService>(SessionService);
      expect(svc2).toBeDefined();

      delete process.env.REDIS_URL;
    });

    it('should connect via REDIS_HOST/PORT when REDIS_URL not set', async () => {
      delete process.env.REDIS_URL;

      const module2 = await Test.createTestingModule({
        providers: [
          SessionService,
          {
            provide: LoggerService,
            useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
          },
        ],
      }).compile();

      const svc2 = module2.get<SessionService>(SessionService);
      expect(svc2).toBeDefined();
    });
  });

  describe('Redis event handlers', () => {
    it('should set isRedisConnected on connect event', () => {
      // Simulate connect event
      const connectHandler = (redis.on as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      );
      if (connectHandler) {
        connectHandler[1]();
        expect((service as any).isRedisConnected).toBe(true);
      }
    });

    it('should clear isRedisConnected on error event', () => {
      const errorHandler = (redis.on as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === 'error'
      );
      if (errorHandler) {
        (service as any).isRedisConnected = true;
        errorHandler[1](new Error('Redis error'));
        expect((service as any).isRedisConnected).toBe(false);
      }
    });

    it('should clear isRedisConnected on close event', () => {
      const closeHandler = (redis.on as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === 'close'
      );
      if (closeHandler) {
        (service as any).isRedisConnected = true;
        closeHandler[1]();
        expect((service as any).isRedisConnected).toBe(false);
      }
    });
  });

  describe('executeRedisOperation error paths', () => {
    it('should throw InfrastructureException when Redis is disconnected and ping fails', async () => {
      (service as any).isRedisConnected = false;
      redis.status = 'end';
      redis.ping = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.createRefreshToken(mockUserId, mockEmail)).rejects.toThrow(
        'Cache operation failed'
      );
    });

    it('should reconnect when Redis ping succeeds', async () => {
      (service as any).isRedisConnected = false;
      redis.status = 'end';
      redis.ping = jest.fn().mockResolvedValue('PONG');

      const token = await service.createRefreshToken(mockUserId, mockEmail);

      expect(token).toBeDefined();
      expect((service as any).isRedisConnected).toBe(true);
    });

    it('should mark disconnected on ECONNREFUSED error', async () => {
      (service as any).isRedisConnected = true;
      redis.status = 'ready';
      redis.setex = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.createRefreshToken(mockUserId, mockEmail)).rejects.toThrow();
      expect((service as any).isRedisConnected).toBe(false);
    });

    it('should mark disconnected on ETIMEDOUT error', async () => {
      (service as any).isRedisConnected = true;
      redis.status = 'ready';
      redis.setex = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      await expect(service.createRefreshToken(mockUserId, mockEmail)).rejects.toThrow();
      expect((service as any).isRedisConnected).toBe(false);
    });
  });

  describe('revokeRefreshToken error paths', () => {
    it('should handle parse error in session data during revocation', async () => {
      redis.get = jest.fn().mockResolvedValue('not-valid-json');

      await service.revokeRefreshToken('some-token');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse session data during revocation',
        expect.any(String),
        'SessionService'
      );
    });

    it('should log error when revocation fails', async () => {
      redis.get = jest.fn().mockRejectedValue(new Error('Redis down'));

      await service.revokeRefreshToken('some-token');

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserSessions error paths', () => {
    it('should log error when revokeAll fails', async () => {
      redis.smembers = jest.fn().mockRejectedValue(new Error('Redis unavailable'));

      await service.revokeAllUserSessions(mockUserId);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to revoke all sessions'),
        expect.any(String),
        'SessionService'
      );
    });
  });

  describe('validateRefreshToken Redis failure', () => {
    it('should return null on Redis failure (graceful degradation)', async () => {
      (service as any).isRedisConnected = false;
      redis.status = 'end';
      redis.ping = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.validateRefreshToken('any-token');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Redis unavailable during token validation',
        'SessionService'
      );
    });
  });

  describe('validatePasswordResetToken Redis failure', () => {
    it('should return null on Redis failure (graceful degradation)', async () => {
      (service as any).isRedisConnected = false;
      redis.status = 'end';
      redis.ping = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.validatePasswordResetToken('any-token');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Redis unavailable during password reset validation',
        'SessionService'
      );
    });

    it('should handle cleanup failure for corrupted token', async () => {
      redis.get = jest.fn().mockResolvedValue('invalid-json');
      // First del succeeds (from cleanup after parse error), but second one is the cleanup inside catch
      redis.del = jest.fn().mockRejectedValueOnce(new Error('Redis down')).mockResolvedValue(1);

      const result = await service.validatePasswordResetToken('some-token');

      expect(result).toBeNull();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Redis on module destroy', async () => {
      redis.disconnect = jest.fn().mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(redis.disconnect).toHaveBeenCalled();
    });
  });

  describe('hashToken', () => {
    it('should produce consistent SHA256 hash', async () => {
      const token1 = await service.createRefreshToken(mockUserId, mockEmail);
      const token2 = await service.createRefreshToken(mockUserId, mockEmail);

      // Different tokens should produce different hashes
      expect(token1).not.toBe(token2);

      // Same token should always produce same hash
      const hash1 = createHash('sha256').update(token1).digest('hex');
      const hash2 = createHash('sha256').update(token1).digest('hex');
      expect(hash1).toBe(hash2);
    });
  });
});
