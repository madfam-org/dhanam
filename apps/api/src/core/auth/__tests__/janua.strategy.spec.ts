import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

import { JanuaStrategy, JanuaJwtPayload } from '../strategies/janua.strategy';

// JanuaStrategy constructor calls `super()` which needs JWKS env vars.
// We set them here so the strategy can be instantiated in tests.
process.env.JANUA_JWKS_URI = 'https://auth.madfam.io/.well-known/jwks.json';
process.env.JANUA_ISSUER = 'https://auth.madfam.io';
process.env.JANUA_AUDIENCE = 'dhanam-api';

describe('JanuaStrategy', () => {
  let strategy: JanuaStrategy;
  let prisma: {
    user: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    space: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const basePayload: JanuaJwtPayload = {
    sub: 'janua-user-001',
    email: 'new@example.com',
    iss: 'https://auth.madfam.io',
    aud: 'dhanam-api',
    exp: Math.floor(Date.now() / 1000) + 900,
    iat: Math.floor(Date.now() / 1000),
    jti: 'token-id-001',
    name: 'New User',
    locale: 'es',
  };

  const existingUser = {
    id: 'janua-user-001',
    email: 'existing@example.com',
    name: 'Existing User',
    locale: 'en',
    isActive: true,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      space: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JanuaStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();

    strategy = module.get<JanuaStrategy>(JanuaStrategy);
    jest.clearAllMocks();
  });

  describe('validate - existing user', () => {
    it('should return user context for an existing active user', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);

      const result = await strategy.validate(basePayload);

      expect(result.id).toBe('janua-user-001');
      expect(result.email).toBe('new@example.com');
      expect(result.dhanamUserId).toBe('janua-user-001');
    });

    it('should throw UnauthorizedException for suspended users', async () => {
      const payload = { ...basePayload, sub_status: 'suspended' as const };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive local users', async () => {
      prisma.user.findFirst.mockResolvedValue({ ...existingUser, isActive: false });

      await expect(strategy.validate(basePayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if token is missing sub or email', async () => {
      const noSub = { ...basePayload, sub: '' };
      await expect(strategy.validate(noSub)).rejects.toThrow(UnauthorizedException);

      const noEmail = { ...basePayload, email: '' };
      await expect(strategy.validate(noEmail)).rejects.toThrow(UnauthorizedException);
    });

    it('should sync name when it changes', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);
      prisma.user.update.mockResolvedValue(existingUser);

      const payload = { ...basePayload, name: 'Updated Name' };
      await strategy.validate(payload);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: { name: 'Updated Name' },
      });
    });
  });

  describe('validate - JIT provisioning', () => {
    it('should create user and space in a single transaction', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const createdUser = {
        id: basePayload.sub,
        email: basePayload.email,
        name: 'New User',
        locale: 'es',
        isActive: true,
      };

      // $transaction receives a callback; execute it with a mock tx client
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          user: { create: jest.fn().mockResolvedValue(createdUser) },
          space: { create: jest.fn().mockResolvedValue({ id: 'space-new' }) },
        };
        return fn(tx);
      });

      const result = await strategy.validate(basePayload);

      // Verify $transaction was called (not separate prisma.user.create / prisma.space.create)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.space.create).not.toHaveBeenCalled();

      expect(result.id).toBe(basePayload.sub);
      expect(result.dhanamUserId).toBe(basePayload.sub);
    });

    it('should roll back both user and space if transaction fails', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(new Error('Unique constraint violation'));

      // Should NOT throw — the outer catch swallows provisioning errors
      const result = await strategy.validate(basePayload);

      // User still gets a valid JWT context (with payload.sub as fallback)
      expect(result.id).toBe(basePayload.sub);
      expect(result.dhanamUserId).toBeUndefined();
    });

    it('should use Janua ID as primary key for new users', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      let capturedUserData: any;
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          user: {
            create: jest.fn().mockImplementation((args) => {
              capturedUserData = args.data;
              return Promise.resolve({
                id: args.data.id,
                email: args.data.email,
                name: args.data.name,
                locale: args.data.locale,
                isActive: true,
              });
            }),
          },
          space: { create: jest.fn().mockResolvedValue({ id: 'space-new' }) },
        };
        return fn(tx);
      });

      await strategy.validate(basePayload);

      expect(capturedUserData.id).toBe(basePayload.sub);
      expect(capturedUserData.email).toBe(basePayload.email);
      expect(capturedUserData.passwordHash).toBe('');
    });
  });

  describe('validate - default claims', () => {
    it('should default tier to community when not in payload', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);

      const result = await strategy.validate(basePayload);

      expect(result.tier).toBe('community');
    });

    it('should default isAdmin to false when not in payload', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);

      const result = await strategy.validate(basePayload);

      expect(result.isAdmin).toBe(false);
    });

    it('should pass through tier and admin claims when present', async () => {
      prisma.user.findFirst.mockResolvedValue(existingUser);

      const payload = { ...basePayload, tier: 'pro' as const, is_admin: true };
      const result = await strategy.validate(payload);

      expect(result.tier).toBe('pro');
      expect(result.isAdmin).toBe(true);
    });
  });
});
