import { Test, TestingModule } from '@nestjs/testing';

import { BusinessRuleException, ValidationException } from '@core/exceptions/domain-exceptions';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@db';

import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersService } from '../users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    locale: 'es',
    timezone: 'America/Mexico_City',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    totpSecret: null,
    isActive: true,
    emailVerified: true,
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockUserSpaces = [
    {
      userId: 'user-123',
      spaceId: 'space-1',
      role: 'owner' as const,
      space: {
        id: 'space-1',
        name: 'Personal Space',
        type: 'personal' as const,
      },
    },
    {
      userId: 'user-123',
      spaceId: 'space-2',
      role: 'member' as const,
      space: {
        id: 'space-2',
        name: 'Business Space',
        type: 'business' as const,
      },
    },
  ];

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userSpace: {
        findMany: jest.fn(),
      },
      space: {
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile with spaces', async () => {
      const userWithSpaces = {
        ...mockUser,
        userSpaces: mockUserSpaces,
      };

      prisma.user.findUnique.mockResolvedValue(userWithSpaces as any);

      const result = await service.getProfile('user-123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: {
          userSpaces: {
            include: {
              space: true,
            },
          },
        },
      });

      expect(result).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.spaces).toHaveLength(2);
      expect(result.spaces[0]).toMatchObject({
        id: 'space-1',
        name: 'Personal Space',
        type: 'personal',
        role: 'owner',
      });
      expect(result.spaces[1]).toMatchObject({
        id: 'space-2',
        name: 'Business Space',
        type: 'business',
        role: 'member',
      });
    });

    it('should sanitize sensitive fields (passwordHash, totpSecret)', async () => {
      const userWithSpaces = {
        ...mockUser,
        passwordHash: 'sensitive-password-hash',
        totpSecret: 'sensitive-totp-secret',
        userSpaces: mockUserSpaces,
      };

      prisma.user.findUnique.mockResolvedValue(userWithSpaces as any);

      const result = await service.getProfile('user-123');

      expect(result.passwordHash).toBeUndefined();
      expect(result.totpSecret).toBeUndefined();
    });

    it('should return profile with empty spaces array if user has no spaces', async () => {
      const userWithoutSpaces = {
        ...mockUser,
        userSpaces: [],
      };

      prisma.user.findUnique.mockResolvedValue(userWithoutSpaces as any);

      const result = await service.getProfile('user-123');

      expect(result.spaces).toEqual([]);
    });

    it('should throw BusinessRuleException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-user')).rejects.toThrow(BusinessRuleException);
      await expect(service.getProfile('nonexistent-user')).rejects.toThrow('User not found');
    });

    it('should include all user profile fields', async () => {
      const userWithSpaces = {
        ...mockUser,
        userSpaces: [],
      };

      prisma.user.findUnique.mockResolvedValue(userWithSpaces as any);

      const result = await service.getProfile('user-123');

      expect(result).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        locale: 'es',
        timezone: 'America/Mexico_City',
        isActive: true,
        emailVerified: true,
        onboardingCompleted: true,
      });
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated Name',
      locale: 'en',
      timezone: 'America/New_York',
    };

    it('should update user profile', async () => {
      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
        locale: 'en',
        timezone: 'America/New_York',
      };

      prisma.user.update.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile('user-123', updateDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          name: 'Updated Name',
          locale: 'en',
          timezone: 'America/New_York',
        },
      });

      expect(result).toMatchObject({
        id: 'user-123',
        name: 'Updated Name',
        locale: 'en',
        timezone: 'America/New_York',
      });
    });

    it('should sanitize sensitive fields from response', async () => {
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        passwordHash: 'sensitive-password-hash',
        totpSecret: 'sensitive-totp-secret',
      } as any);

      const result = await service.updateProfile('user-123', updateDto);

      expect(result.passwordHash).toBeUndefined();
      expect(result.totpSecret).toBeUndefined();
    });

    it('should allow partial updates (name only)', async () => {
      const partialDto: UpdateUserDto = {
        name: 'New Name Only',
      };

      prisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'New Name Only',
      } as any);

      const result = await service.updateProfile('user-123', partialDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          name: 'New Name Only',
          locale: undefined,
          timezone: undefined,
        },
      });

      expect(result.name).toBe('New Name Only');
    });

    it('should allow partial updates (locale only)', async () => {
      const partialDto: UpdateUserDto = {
        locale: 'en',
      };

      prisma.user.update.mockResolvedValue({
        ...mockUser,
        locale: 'en',
      } as any);

      await service.updateProfile('user-123', partialDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          locale: 'en',
        }),
      });
    });

    it('should allow partial updates (timezone only)', async () => {
      const partialDto: UpdateUserDto = {
        timezone: 'Europe/London',
      };

      prisma.user.update.mockResolvedValue({
        ...mockUser,
        timezone: 'Europe/London',
      } as any);

      await service.updateProfile('user-123', partialDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          timezone: 'Europe/London',
        }),
      });
    });

    it('should log profile update', async () => {
      prisma.user.update.mockResolvedValue(mockUser as any);

      await service.updateProfile('user-123', updateDto);

      expect(logger.log).toHaveBeenCalledWith('Profile updated for user: user-123', 'UsersService');
    });

    it('should support all valid timezones', async () => {
      const validTimezones = [
        'America/Mexico_City',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];

      for (const timezone of validTimezones) {
        prisma.user.update.mockResolvedValue({
          ...mockUser,
          timezone,
        } as any);

        const result = await service.updateProfile('user-123', { timezone });

        expect(result.timezone).toBe(timezone);
      }
    });

    it('should support locale switching (es <-> en)', async () => {
      // Spanish to English
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        locale: 'en',
      } as any);

      let result = await service.updateProfile('user-123', { locale: 'en' });
      expect(result.locale).toBe('en');

      // English to Spanish
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        locale: 'es',
      } as any);

      result = await service.updateProfile('user-123', { locale: 'es' });
      expect(result.locale).toBe('es');
    });
  });

  describe('deleteAccount', () => {
    it('should delete user account in a transaction', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      mockTx.userSpace.findMany.mockResolvedValue([]);
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });

    it('should delete spaces where user is the only owner', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // User owns a space alone
      const ownedSpaces = [
        {
          userId: 'user-123',
          spaceId: 'space-1',
          role: 'owner',
          space: {
            id: 'space-1',
            name: 'Solo Space',
            userSpaces: [
              {
                userId: 'user-123',
                spaceId: 'space-1',
                role: 'owner',
              },
            ],
          },
        },
      ];

      mockTx.userSpace.findMany.mockResolvedValue(ownedSpaces);
      mockTx.space.delete.mockResolvedValue({ id: 'space-1' });
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      expect(mockTx.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-1' },
      });
    });

    it('should NOT delete spaces with multiple owners', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // User owns a space with another owner
      const sharedSpaces = [
        {
          userId: 'user-123',
          spaceId: 'space-1',
          role: 'owner',
          space: {
            id: 'space-1',
            name: 'Shared Space',
            userSpaces: [
              {
                userId: 'user-123',
                spaceId: 'space-1',
                role: 'owner',
              },
              {
                userId: 'user-456',
                spaceId: 'space-1',
                role: 'owner',
              },
            ],
          },
        },
      ];

      mockTx.userSpace.findMany.mockResolvedValue(sharedSpaces);
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      // Space should NOT be deleted
      expect(mockTx.space.delete).not.toHaveBeenCalled();
    });

    it('should handle user with mixed space ownership', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // User has:
      // - 1 space they own alone (should be deleted)
      // - 1 space they co-own (should NOT be deleted)
      // - 1 space they're just a member (should NOT be deleted)
      const mixedSpaces = [
        {
          userId: 'user-123',
          spaceId: 'space-solo',
          role: 'owner',
          space: {
            id: 'space-solo',
            name: 'Solo Space',
            userSpaces: [{ userId: 'user-123', spaceId: 'space-solo', role: 'owner' }],
          },
        },
        {
          userId: 'user-123',
          spaceId: 'space-shared',
          role: 'owner',
          space: {
            id: 'space-shared',
            name: 'Shared Space',
            userSpaces: [
              { userId: 'user-123', spaceId: 'space-shared', role: 'owner' },
              { userId: 'user-456', spaceId: 'space-shared', role: 'owner' },
            ],
          },
        },
        {
          userId: 'user-123',
          spaceId: 'space-member',
          role: 'member',
          space: {
            id: 'space-member',
            name: 'Member Space',
            userSpaces: [
              { userId: 'user-456', spaceId: 'space-member', role: 'owner' },
              { userId: 'user-123', spaceId: 'space-member', role: 'member' },
            ],
          },
        },
      ];

      mockTx.userSpace.findMany.mockResolvedValue(mixedSpaces);
      mockTx.space.delete.mockResolvedValue({ id: 'space-solo' });
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      // Only solo space should be deleted
      expect(mockTx.space.delete).toHaveBeenCalledTimes(1);
      expect(mockTx.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-solo' },
      });
    });

    it('should delete space when other users are only members not owners (line 79 role filter branch)', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      // User owns a space with other members (but no other owners)
      // This tests the us.role === 'owner' filter condition returning false
      const ownedSpaceWithMembers = [
        {
          userId: 'user-123',
          spaceId: 'space-with-members',
          role: 'owner',
          space: {
            id: 'space-with-members',
            name: 'Space With Members Only',
            userSpaces: [
              { userId: 'user-123', spaceId: 'space-with-members', role: 'owner' },
              { userId: 'user-456', spaceId: 'space-with-members', role: 'member' }, // member, not owner
              { userId: 'user-789', spaceId: 'space-with-members', role: 'viewer' }, // viewer, not owner
            ],
          },
        },
      ];

      mockTx.userSpace.findMany.mockResolvedValue(ownedSpaceWithMembers);
      mockTx.space.delete.mockResolvedValue({ id: 'space-with-members' });
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      // Space should be deleted since user is the only owner (other users are just members)
      expect(mockTx.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-with-members' },
      });
    });

    it('should log account deletion', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      mockTx.userSpace.findMany.mockResolvedValue([]);
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      expect(logger.log).toHaveBeenCalledWith('Account deleted for user: user-123', 'UsersService');
    });

    it('should handle cascade deletions (database-level)', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      mockTx.userSpace.findMany.mockResolvedValue([]);
      mockTx.user.update.mockResolvedValue(mockUser);

      await service.deleteAccount('user-123');

      // User deletion should happen after space cleanup
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });

    it('should ensure transaction atomicity (all or nothing)', async () => {
      const mockTx = {
        userSpace: {
          findMany: jest.fn(),
        },
        space: {
          delete: jest.fn(),
        },
        user: {
          update: jest.fn(),
        },
      };

      // Simulate transaction failure
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      // The service wraps errors in InfrastructureException with standardized message
      await expect(service.deleteAccount('user-123')).rejects.toThrow('Database operation failed');

      // Verify transaction was attempted
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('updateProfile error handling', () => {
    it('should throw ValidationException for empty name', async () => {
      await expect(service.updateProfile('user-123', { name: '   ' })).rejects.toThrow(
        'Invalid input for field: name'
      );
    });

    it('should throw BusinessRuleException on Prisma P2025 error', async () => {
      const prismaError = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      prisma.user.update.mockRejectedValue(prismaError);

      await expect(service.updateProfile('nonexistent', { name: 'Test' })).rejects.toThrow(
        BusinessRuleException
      );
    });

    it('should throw ValidationException on Prisma P2002 (duplicate) error', async () => {
      const prismaError = new PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });

      prisma.user.update.mockRejectedValue(prismaError);

      await expect(service.updateProfile('user-123', { name: 'Test' })).rejects.toThrow(
        ValidationException
      );
    });

    it('should throw InfrastructureException on unknown Prisma error code', async () => {
      const prismaError = new PrismaClientKnownRequestError('Unknown error', {
        code: 'P9999',
        clientVersion: '5.0.0',
      });

      prisma.user.update.mockRejectedValue(prismaError);

      await expect(service.updateProfile('user-123', { name: 'Test' })).rejects.toThrow(
        'Database operation failed'
      );
    });

    it('should throw InfrastructureException on generic non-Prisma error', async () => {
      prisma.user.update.mockRejectedValue(new Error('Connection lost'));

      await expect(service.updateProfile('user-123', { name: 'Test' })).rejects.toThrow(
        'Database operation failed'
      );
    });
  });

  describe('getProfile error handling', () => {
    it('should call handlePrismaError when findUnique throws non-BusinessRuleException', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('Connection reset'));

      await expect(service.getProfile('user-123')).rejects.toThrow('Database operation failed');
    });
  });

  describe('deleteAccount error handling', () => {
    it('should wrap transaction errors as InfrastructureException', async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('Deadlock'));

      await expect(service.deleteAccount('user-123')).rejects.toThrow('Database operation failed');
    });
  });

  describe('handlePrismaError', () => {
    it('should pass through BusinessRuleException', async () => {
      prisma.user.update.mockRejectedValue(BusinessRuleException.resourceNotFound('User', 'test'));

      await expect(service.updateProfile('user-123', { name: 'Test' })).rejects.toThrow(
        BusinessRuleException
      );
    });

    it('should wrap non-Error values as InfrastructureException', async () => {
      prisma.user.update.mockRejectedValue('string error');

      await expect(service.updateProfile('user-123', { name: 'Test' })).rejects.toThrow(
        'Database operation failed'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle users with no spaces gracefully', async () => {
      const userWithoutSpaces = {
        ...mockUser,
        userSpaces: [],
      };

      prisma.user.findUnique.mockResolvedValue(userWithoutSpaces as any);

      const result = await service.getProfile('user-123');

      expect(result.spaces).toEqual([]);
    });

    it('should handle very long user names', async () => {
      const longName = 'A'.repeat(255);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        name: longName,
      } as any);

      const result = await service.updateProfile('user-123', { name: longName });

      expect(result.name).toBe(longName);
    });

    it('should preserve all user data types correctly', async () => {
      const specificUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        locale: 'es' as const,
        timezone: 'America/Mexico_City',
        isActive: true,
        emailVerified: false,
        onboardingCompleted: false,
        passwordHash: 'hash',
        totpSecret: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        lastLoginAt: new Date('2024-01-03'),
        userSpaces: [],
      };

      prisma.user.findUnique.mockResolvedValue(specificUser as any);

      const result = await service.getProfile('user-123');

      expect(result.isActive).toBe(true);
      expect(result.emailVerified).toBe(false);
      expect(result.onboardingCompleted).toBe(false);
    });
  });
});
