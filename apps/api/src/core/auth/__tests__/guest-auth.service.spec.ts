import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

import { DemoAuthService } from '../demo-auth.service';
import { GuestAuthService } from '../guest-auth.service';

describe('GuestAuthService', () => {
  let service: GuestAuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let demoAuthService: jest.Mocked<DemoAuthService>;

  const mockGuestUser = {
    id: 'guest-user-id',
    email: 'guest@dhanam.demo',
    name: 'Guest User',
    passwordHash: 'GUEST_NO_PASSWORD',
    locale: 'en',
    timezone: 'America/Mexico_City',
    emailVerified: true,
    onboardingCompleted: true,
    onboardingCompletedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    totpSecret: null,
    totpEnabled: false,
    isActive: true,
    lastLoginAt: null,
  };

  const mockLoginResult = {
    user: mockGuestUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    persona: 'guest',
    message: 'Guest session created',
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      space: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockDemoAuthService = {
      loginAsPersona: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuestAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DemoAuthService, useValue: mockDemoAuthService },
      ],
    }).compile();

    service = module.get<GuestAuthService>(GuestAuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    demoAuthService = module.get(DemoAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createGuestSession', () => {
    it('should delegate to demoAuthService.loginAsPersona with guest', async () => {
      demoAuthService.loginAsPersona.mockResolvedValue(mockLoginResult as any);

      await service.createGuestSession();

      expect(demoAuthService.loginAsPersona).toHaveBeenCalledWith('guest', undefined);
    });

    it('should pass countryCode to loginAsPersona', async () => {
      demoAuthService.loginAsPersona.mockResolvedValue(mockLoginResult as any);

      await service.createGuestSession('MX');

      expect(demoAuthService.loginAsPersona).toHaveBeenCalledWith('guest', 'MX');
    });

    it('should return user, tokens, and expiresIn from delegation result', async () => {
      demoAuthService.loginAsPersona.mockResolvedValue(mockLoginResult as any);

      const result = await service.createGuestSession();

      expect(result).toEqual({
        user: mockGuestUser,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      });
    });

    it('should propagate errors from demoAuthService', async () => {
      demoAuthService.loginAsPersona.mockRejectedValue(new Error('Demo service error'));

      await expect(service.createGuestSession()).rejects.toThrow('Demo service error');
    });
  });

  describe('isGuestSession', () => {
    it('should return true for valid guest token', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'guest-user-id',
        isGuest: true,
      });

      const result = await service.isGuestSession('valid-guest-token');

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-guest-token');
    });

    it('should return false for non-guest token', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'regular-user-id',
        isGuest: false,
      });

      const result = await service.isGuestSession('non-guest-token');

      expect(result).toBe(false);
    });

    it('should return false for token without isGuest flag', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-id',
      });

      const result = await service.isGuestSession('token-without-guest-flag');

      expect(result).toBe(false);
    });

    it('should return false for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.isGuestSession('invalid-token');

      expect(result).toBe(false);
    });

    it('should return false for expired token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await service.isGuestSession('expired-token');

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredGuestSessions', () => {
    it('should delete audit logs older than 2 days', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupExpiredGuestSessions();

      expect(prisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          action: 'guest.session_created',
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should calculate correct date threshold (2 days ago)', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      const beforeCall = new Date();
      await service.cleanupExpiredGuestSessions();
      const afterCall = new Date();

      const deleteCall = prisma.auditLog.deleteMany.mock.calls[0][0];
      const thresholdDate = deleteCall.where.createdAt.lt;

      // The threshold should be approximately 2 days before now
      const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
      const expectedMin = new Date(beforeCall.getTime() - twoDaysInMs - 1000);
      const expectedMax = new Date(afterCall.getTime() - twoDaysInMs + 1000);

      expect(thresholdDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(thresholdDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should handle no sessions to cleanup', async () => {
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.cleanupExpiredGuestSessions()).resolves.not.toThrow();
    });

    it('should handle database errors gracefully', async () => {
      prisma.auditLog.deleteMany.mockRejectedValue(new Error('Database error'));

      await expect(service.cleanupExpiredGuestSessions()).rejects.toThrow('Database error');
    });
  });
});
