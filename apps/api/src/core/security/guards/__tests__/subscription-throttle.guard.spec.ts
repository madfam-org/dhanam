import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';

import { SubscriptionThrottleGuard } from '../subscription-throttle.guard';

/**
 * Mock ThrottlerStorage that always returns a non-blocked response.
 */
const createMockStorageService = (): jest.Mocked<ThrottlerStorage> => ({
  increment: jest.fn().mockResolvedValue({
    totalHits: 1,
    timeToExpire: 900_000,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
});

/**
 * Build a minimal ExecutionContext mock for Fastify-style HTTP requests.
 */
const createMockContext = (user?: Record<string, any>, ip = '127.0.0.1'): ExecutionContext => {
  const mockResponse = {
    header: jest.fn(),
  };
  const mockRequest: Record<string, any> = { ip, headers: {}, user };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
    getHandler: jest.fn().mockReturnValue({ name: 'testHandler' }),
    getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
    getType: jest.fn().mockReturnValue('http'),
    getArgs: jest.fn().mockReturnValue([]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext;
};

describe('SubscriptionThrottleGuard', () => {
  let guard: SubscriptionThrottleGuard;
  let storageService: jest.Mocked<ThrottlerStorage>;

  beforeEach(async () => {
    storageService = createMockStorageService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionThrottleGuard,
        {
          provide: 'THROTTLER:MODULE_OPTIONS',
          useValue: {
            throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
          },
        },
        { provide: ThrottlerStorage, useValue: storageService },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    }).compile();

    guard = module.get<SubscriptionThrottleGuard>(SubscriptionThrottleGuard);
    // Trigger onModuleInit to set up internal throttlers array
    await guard.onModuleInit();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('getTracker', () => {
    it('should return userId from req.user.id when present', async () => {
      const req = { user: { id: 'user-abc-123', subscriptionTier: 'pro' }, ip: '10.0.0.1' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:user-abc-123');
    });

    it('should return userId from req.user.userId for backwards compatibility', async () => {
      const req = { user: { userId: 'user-compat-456' }, ip: '10.0.0.1' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:user-compat-456');
    });

    it('should return userId from req.user.sub (raw JWT payload)', async () => {
      const req = { user: { sub: 'user-jwt-789' }, ip: '10.0.0.1' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:user-jwt-789');
    });

    it('should prefer req.user.id over req.user.userId and req.user.sub', async () => {
      const req = {
        user: { id: 'primary-id', userId: 'compat-id', sub: 'jwt-sub' },
        ip: '10.0.0.1',
      };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('user:primary-id');
    });

    it('should fallback to IP address when no user is present', async () => {
      const req = { ip: '192.168.1.100' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('192.168.1.100');
    });

    it('should fallback to IP when user exists but has no id fields', async () => {
      const req = { user: { email: 'test@example.com' }, ip: '10.0.0.2' };
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('10.0.0.2');
    });

    it('should return "unknown" when neither user nor IP is available', async () => {
      const req = {};
      const tracker = await (guard as any).getTracker(req);
      expect(tracker).toBe('unknown');
    });
  });

  describe('tier-based rate limits', () => {
    it('should apply community limit (1000) for community tier users', async () => {
      const context = createMockContext({
        id: 'user-c1',
        subscriptionTier: 'community',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        1_000,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should apply essentials limit (1500) for essentials tier users', async () => {
      const context = createMockContext({
        id: 'user-e1',
        subscriptionTier: 'essentials',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        1_500,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should apply pro limit (2000) for pro tier users', async () => {
      const context = createMockContext({
        id: 'user-p1',
        subscriptionTier: 'pro',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        2_000,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should apply premium limit (3000) for premium tier users', async () => {
      const context = createMockContext({
        id: 'user-pr1',
        subscriptionTier: 'premium',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        3_000,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should default to community limit for unknown subscription tier', async () => {
      const context = createMockContext({
        id: 'user-unknown',
        subscriptionTier: 'enterprise',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        1_000,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should default to community limit when no user is authenticated', async () => {
      const context = createMockContext(undefined);

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        1_000,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should default to community limit when user has no subscriptionTier', async () => {
      const context = createMockContext({
        id: 'user-no-tier',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        SubscriptionThrottleGuard.WINDOW_MS,
        1_000,
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should use fixed 15-minute TTL window for all tiers', async () => {
      const fifteenMinutesMs = 15 * 60 * 1000;
      expect(SubscriptionThrottleGuard.WINDOW_MS).toBe(fifteenMinutesMs);

      const context = createMockContext({
        id: 'user-ttl',
        subscriptionTier: 'pro',
      });

      await guard.canActivate(context);

      expect(storageService.increment).toHaveBeenCalledWith(
        expect.any(String),
        fifteenMinutesMs,
        expect.any(Number),
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('static configuration', () => {
    it('should expose TIER_LIMITS with all four tiers', () => {
      expect(SubscriptionThrottleGuard.TIER_LIMITS).toEqual({
        community: 1_000,
        essentials: 1_500,
        pro: 2_000,
        premium: 3_000,
      });
    });

    it('should set WINDOW_MS to 900000 (15 minutes in ms)', () => {
      expect(SubscriptionThrottleGuard.WINDOW_MS).toBe(900_000);
    });
  });
});
