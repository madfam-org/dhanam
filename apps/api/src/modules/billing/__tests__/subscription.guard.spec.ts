import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { SubscriptionTier } from '@db';

import { TIER_KEY } from '../decorators';
import { PaymentRequiredException, SubscriptionExpiredException } from '../exceptions';
import { SubscriptionGuard } from '../guards/subscription.guard';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (user?: any, tierRequired?: SubscriptionTier): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SubscriptionGuard>(SubscriptionGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no tier requirement is set', async () => {
      const context = mockExecutionContext({ id: 'user-123', subscriptionTier: 'community' });
      reflector.getAllAndOverride.mockReturnValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw PaymentRequiredException when no user is in request', async () => {
      const context = mockExecutionContext(undefined);
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      await expect(guard.canActivate(context)).rejects.toThrow(PaymentRequiredException);
      await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
    });

    it('should allow access when user has required tier (community tier)', async () => {
      const context = mockExecutionContext({
        id: 'user-123',
        subscriptionTier: 'community',
      });
      reflector.getAllAndOverride.mockReturnValue('community' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has pro tier and requires community tier', async () => {
      const context = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
      });
      reflector.getAllAndOverride.mockReturnValue('community' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when user has pro tier and requires pro tier', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const context = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
        subscriptionExpiresAt: futureDate,
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw PaymentRequiredException when community user tries to access pro feature', async () => {
      const context = mockExecutionContext({
        id: 'user-123',
        subscriptionTier: 'community',
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      await expect(guard.canActivate(context)).rejects.toThrow(PaymentRequiredException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'This feature requires a pro subscription. Upgrade at /billing/upgrade'
      );
    });

    it('should throw SubscriptionExpiredException when pro subscription is expired', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const context = mockExecutionContext({
        id: 'user-expired',
        subscriptionTier: 'pro',
        subscriptionExpiresAt: pastDate,
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      await expect(guard.canActivate(context)).rejects.toThrow(SubscriptionExpiredException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Your subscription has expired. Renew at /billing/renew'
      );
    });

    it('should allow access when pro subscription has no expiration date', async () => {
      const context = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
        subscriptionExpiresAt: null,
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access when pro subscription expires today but not yet past', async () => {
      const futureToday = new Date();
      futureToday.setHours(23, 59, 59, 999);

      const context = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
        subscriptionExpiresAt: futureToday,
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should check tier from both handler and class metadata', async () => {
      const context = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
      });

      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      await guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(TIER_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });

  describe('tier hierarchy', () => {
    it('should correctly implement tier hierarchy (community < essentials < pro < premium)', async () => {
      // Community user cannot access pro
      const communityUserContext = mockExecutionContext({
        id: 'user-community',
        subscriptionTier: 'community',
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      await expect(guard.canActivate(communityUserContext)).rejects.toThrow(
        PaymentRequiredException
      );

      // Pro user can access community tier features
      const proUserContext = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
      });
      reflector.getAllAndOverride.mockReturnValue('community' as SubscriptionTier);

      const result = await guard.canActivate(proUserContext);
      expect(result).toBe(true);
    });

    it('should allow premium user access to pro-tier features', async () => {
      const premiumUserContext = mockExecutionContext({
        id: 'user-premium',
        subscriptionTier: 'premium',
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      const result = await guard.canActivate(premiumUserContext);
      expect(result).toBe(true);
    });

    it('should allow premium user access to premium-tier features', async () => {
      const premiumUserContext = mockExecutionContext({
        id: 'user-premium',
        subscriptionTier: 'premium',
      });
      reflector.getAllAndOverride.mockReturnValue('premium' as SubscriptionTier);

      const result = await guard.canActivate(premiumUserContext);
      expect(result).toBe(true);
    });

    it('should block pro user from premium-tier features', async () => {
      const proUserContext = mockExecutionContext({
        id: 'user-pro',
        subscriptionTier: 'pro',
      });
      reflector.getAllAndOverride.mockReturnValue('premium' as SubscriptionTier);

      await expect(guard.canActivate(proUserContext)).rejects.toThrow(PaymentRequiredException);
    });
  });

  describe('admin bypass', () => {
    it('should bypass tier check when user is admin', async () => {
      const context = mockExecutionContext({
        id: 'admin-user',
        subscriptionTier: 'community',
        isAdmin: true,
      });
      reflector.getAllAndOverride.mockReturnValue('premium' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should bypass expiration check when user is admin', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const context = mockExecutionContext({
        id: 'admin-user',
        subscriptionTier: 'community',
        isAdmin: true,
        subscriptionExpiresAt: pastDate,
      });
      reflector.getAllAndOverride.mockReturnValue('premium' as SubscriptionTier);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should not bypass when isAdmin is false', async () => {
      const context = mockExecutionContext({
        id: 'user-123',
        subscriptionTier: 'community',
        isAdmin: false,
      });
      reflector.getAllAndOverride.mockReturnValue('pro' as SubscriptionTier);

      await expect(guard.canActivate(context)).rejects.toThrow(PaymentRequiredException);
    });
  });
});
