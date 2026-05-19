import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';

import { DemoAuthService } from '../demo-auth.service';
import { DemoDataBuilder } from '../demo-data.builder';

jest.mock('../demo-data.builder');

describe('DemoAuthService', () => {
  let service: DemoAuthService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-id-123',
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

  beforeEach(async () => {
    const mockPrisma = {
      user: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('mock-secret'),
    };

    // Mock DemoDataBuilder.prototype.buildPersona
    (DemoDataBuilder as jest.MockedClass<typeof DemoDataBuilder>).prototype.buildPersona = jest
      .fn()
      .mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoAuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<DemoAuthService>(DemoAuthService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loginAsPersona', () => {
    it('should throw NotFoundException for unknown persona', async () => {
      await expect(service.loginAsPersona('unknown')).rejects.toThrow(NotFoundException);
    });

    it('should return user and tokens for valid persona', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.loginAsPersona('guest');

      expect(result.user).toEqual(mockUser);
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.persona).toBe('guest');
    });

    it('should throw ServiceUnavailableException on Prisma P2021 error', async () => {
      const prismaError = new Error('Table not found') as Error & { code: string };
      prismaError.code = 'P2021';
      prisma.user.findUnique.mockRejectedValue(prismaError);

      await expect(service.loginAsPersona('guest')).rejects.toThrow(ServiceUnavailableException);
      await expect(service.loginAsPersona('guest')).rejects.toThrow(
        'Demo mode is temporarily unavailable'
      );
    });

    it('should throw ServiceUnavailableException on Prisma P2010 error', async () => {
      const prismaError = new Error('Raw query failed') as Error & { code: string };
      prismaError.code = 'P2010';
      prisma.user.findUnique.mockRejectedValue(prismaError);

      await expect(service.loginAsPersona('guest')).rejects.toThrow(ServiceUnavailableException);
    });

    it('should re-throw non-Prisma errors', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Network error'));

      await expect(service.loginAsPersona('guest')).rejects.toThrow('Network error');
    });

    it('should create audit log entry', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.auditLog.create.mockResolvedValue({} as any);

      await service.loginAsPersona('guest');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          action: 'demo.persona_login',
          ipAddress: 'demo',
          userAgent: 'demo-access',
        }),
      });
    });
  });

  describe('switchPersona', () => {
    it('should throw NotFoundException for unknown persona', async () => {
      await expect(service.switchPersona('user-1', 'unknown')).rejects.toThrow(NotFoundException);
    });

    it('should throw ServiceUnavailableException on Prisma P2021 error', async () => {
      const prismaError = new Error('Table not found') as Error & { code: string };
      prismaError.code = 'P2021';
      prisma.user.findUnique.mockRejectedValue(prismaError);

      await expect(service.switchPersona('user-1', 'maria')).rejects.toThrow(
        ServiceUnavailableException
      );
    });

    it('should return user and tokens on success', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, email: 'maria@dhanam.demo' } as any);
      prisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.switchPersona('user-1', 'maria');

      expect(result.persona).toBe('maria');
      expect(result.accessToken).toBe('mock-token');
    });
  });

  describe('getAvailablePersonas', () => {
    it('should return all 5 personas', () => {
      const personas = service.getAvailablePersonas();

      expect(personas).toHaveLength(5);
      expect(personas.map((p) => p.key)).toEqual(['guest', 'maria', 'carlos', 'patricia', 'diego']);
    });

    it('should include required fields for each persona', () => {
      const personas = service.getAvailablePersonas();

      for (const persona of personas) {
        expect(persona).toHaveProperty('key');
        expect(persona).toHaveProperty('email');
        expect(persona).toHaveProperty('name');
        expect(persona).toHaveProperty('archetype');
        expect(persona).toHaveProperty('features');
        expect(persona).toHaveProperty('emoji');
        expect(persona.features.length).toBeGreaterThan(0);
      }
    });
  });
});
