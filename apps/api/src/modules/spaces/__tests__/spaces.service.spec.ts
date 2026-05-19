import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';

import { CreateSpaceDto } from '../dto/create-space.dto';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto';
import { UpdateSpaceDto } from '../dto/update-space.dto';
import { SpacesService } from '../spaces.service';

describe('SpacesService', () => {
  let service: SpacesService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSpace = {
    id: 'space-123',
    name: 'Test Space',
    type: 'personal' as const,
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserSpace = {
    userId: 'user-123',
    spaceId: 'space-123',
    role: 'owner' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      space: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userSpace: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpacesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SpacesService>(SpacesService);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSpace', () => {
    const createDto: CreateSpaceDto = {
      name: 'My Personal Space',
      type: 'personal',
      currency: 'MXN',
    };

    it('should create a personal space with owner role', async () => {
      prisma.space.create.mockResolvedValue(mockSpace as any);

      const result = await service.createSpace('user-123', createDto);

      expect(prisma.space.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          type: createDto.type,
          currency: createDto.currency,
          userSpaces: {
            create: {
              userId: 'user-123',
              role: 'owner',
            },
          },
        },
      });

      expect(result).toMatchObject({
        id: mockSpace.id,
        name: mockSpace.name,
        type: mockSpace.type,
        role: 'owner',
      });
    });

    it('should create a business space', async () => {
      const businessDto: CreateSpaceDto = {
        name: 'My Business',
        type: 'business',
        currency: 'USD',
      };

      prisma.space.create.mockResolvedValue({
        ...mockSpace,
        type: 'business',
        currency: 'USD',
      } as any);

      const result = await service.createSpace('user-123', businessDto);

      expect(prisma.space.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'business',
          currency: 'USD',
        }),
      });

      expect(result.type).toBe('business');
    });

    it('should default to MXN currency if not provided', async () => {
      const dtoWithoutCurrency = {
        name: 'Test Space',
        type: 'personal' as const,
      };

      prisma.space.create.mockResolvedValue(mockSpace as any);

      await service.createSpace('user-123', dtoWithoutCurrency as CreateSpaceDto);

      expect(prisma.space.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          currency: 'MXN',
        }),
      });
    });

    it('should log space creation', async () => {
      prisma.space.create.mockResolvedValue(mockSpace as any);

      await service.createSpace('user-123', createDto);

      expect(logger.log).toHaveBeenCalledWith(
        `Space created: ${mockSpace.id} by user: user-123`,
        'SpacesService'
      );
    });

    it('should return space with ISO date strings', async () => {
      prisma.space.create.mockResolvedValue(mockSpace as any);

      const result = await service.createSpace('user-123', createDto);

      expect(typeof result.createdAt).toBe('string');
      expect(typeof result.updatedAt).toBe('string');
    });
  });

  describe('listUserSpaces', () => {
    it('should return all spaces for a user with their roles', async () => {
      const userSpaces = [
        {
          userId: 'user-123',
          spaceId: 'space-1',
          role: 'owner' as const,
          space: {
            id: 'space-1',
            name: 'Personal Space',
            type: 'personal' as const,
            currency: 'MXN',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          userId: 'user-123',
          spaceId: 'space-2',
          role: 'member' as const,
          space: {
            id: 'space-2',
            name: 'Shared Business',
            type: 'business' as const,
            currency: 'USD',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      prisma.userSpace.findMany.mockResolvedValue(userSpaces as any);

      const result = await service.listUserSpaces('user-123');

      expect(prisma.userSpace.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { space: true },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'space-1',
        name: 'Personal Space',
        role: 'owner',
      });
      expect(result[1]).toMatchObject({
        id: 'space-2',
        name: 'Shared Business',
        role: 'member',
      });
    });

    it('should return empty array for user with no spaces', async () => {
      prisma.userSpace.findMany.mockResolvedValue([]);

      const result = await service.listUserSpaces('user-123');

      expect(result).toEqual([]);
    });
  });

  describe('getSpace', () => {
    it('should return space details', async () => {
      prisma.space.findUnique.mockResolvedValue(mockSpace as any);

      const result = await service.getSpace('space-123');

      expect(prisma.space.findUnique).toHaveBeenCalledWith({
        where: { id: 'space-123' },
      });

      expect(result).toMatchObject({
        id: mockSpace.id,
        name: mockSpace.name,
        type: mockSpace.type,
      });
    });

    it('should throw NotFoundException if space does not exist', async () => {
      prisma.space.findUnique.mockResolvedValue(null);

      await expect(service.getSpace('nonexistent-space')).rejects.toThrow(
        new NotFoundException('Space not found')
      );
    });
  });

  describe('updateSpace', () => {
    const updateDto: UpdateSpaceDto = {
      name: 'Updated Space Name',
      currency: 'USD',
    };

    it('should update space details', async () => {
      const updatedSpace = {
        ...mockSpace,
        name: 'Updated Space Name',
        currency: 'USD',
      };

      prisma.space.update.mockResolvedValue(updatedSpace as any);

      const result = await service.updateSpace('space-123', updateDto);

      expect(prisma.space.update).toHaveBeenCalledWith({
        where: { id: 'space-123' },
        data: {
          name: updateDto.name,
          currency: updateDto.currency,
        },
      });

      expect(result.name).toBe('Updated Space Name');
      expect(result.currency).toBe('USD');
    });

    it('should log space update', async () => {
      prisma.space.update.mockResolvedValue(mockSpace as any);

      await service.updateSpace('space-123', updateDto);

      expect(logger.log).toHaveBeenCalledWith('Space updated: space-123', 'SpacesService');
    });
  });

  describe('deleteSpace', () => {
    it('should delete space', async () => {
      prisma.space.delete.mockResolvedValue(mockSpace as any);

      await service.deleteSpace('space-123');

      expect(prisma.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-123' },
      });
    });

    it('should log space deletion', async () => {
      prisma.space.delete.mockResolvedValue(mockSpace as any);

      await service.deleteSpace('space-123');

      expect(logger.log).toHaveBeenCalledWith('Space deleted: space-123', 'SpacesService');
    });
  });

  describe('listMembers', () => {
    it('should return all space members with their details', async () => {
      const members = [
        {
          userId: 'user-1',
          spaceId: 'space-123',
          role: 'owner' as const,
          createdAt: new Date('2024-01-01'),
          user: {
            id: 'user-1',
            email: 'owner@example.com',
            name: 'Owner User',
          },
        },
        {
          userId: 'user-2',
          spaceId: 'space-123',
          role: 'member' as const,
          createdAt: new Date('2024-01-02'),
          user: {
            id: 'user-2',
            email: 'member@example.com',
            name: 'Member User',
          },
        },
      ];

      prisma.userSpace.findMany.mockResolvedValue(members as any);

      const result = await service.listMembers('space-123');

      expect(prisma.userSpace.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-123' },
        include: { user: true },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: 'user-1',
        email: 'owner@example.com',
        name: 'Owner User',
        role: 'owner',
      });
      expect(result[1]).toMatchObject({
        userId: 'user-2',
        email: 'member@example.com',
        name: 'Member User',
        role: 'member',
      });
    });
  });

  describe('inviteMember', () => {
    const inviteDto: InviteMemberDto = {
      email: 'newmember@example.com',
      role: 'member',
    };

    it('should invite a user to a space', async () => {
      const newMember = {
        id: 'user-456',
        email: 'newmember@example.com',
        name: 'New Member',
      };

      prisma.user.findUnique.mockResolvedValue(newMember as any);
      prisma.userSpace.findUnique.mockResolvedValue(null);
      prisma.userSpace.create.mockResolvedValue({
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
        createdAt: new Date(),
        user: newMember,
      } as any);

      const result = await service.inviteMember('space-123', inviteDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newmember@example.com' },
      });

      expect(prisma.userSpace.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-456',
          spaceId: 'space-123',
          role: 'member',
        },
        include: { user: true },
      });

      expect(result).toMatchObject({
        userId: 'user-456',
        email: 'newmember@example.com',
        role: 'member',
      });
    });

    it('should normalize email to lowercase', async () => {
      const inviteDtoUppercase = {
        email: 'NewMember@EXAMPLE.COM',
        role: 'member' as const,
      };

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        email: 'newmember@example.com',
        name: 'New Member',
      } as any);
      prisma.userSpace.findUnique.mockResolvedValue(null);
      prisma.userSpace.create.mockResolvedValue({
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
        createdAt: new Date(),
        user: { id: 'user-456', email: 'newmember@example.com', name: 'New Member' },
      } as any);

      await service.inviteMember('space-123', inviteDtoUppercase);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newmember@example.com' },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.inviteMember('space-123', inviteDto)).rejects.toThrow(
        new NotFoundException('User not found')
      );
    });

    it('should throw BadRequestException if user is already a member', async () => {
      const existingMember = {
        id: 'user-456',
        email: 'newmember@example.com',
        name: 'New Member',
      };

      prisma.user.findUnique.mockResolvedValue(existingMember as any);
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
      } as any);

      await expect(service.inviteMember('space-123', inviteDto)).rejects.toThrow(
        new BadRequestException('User is already a member')
      );
    });

    it('should log member invitation', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        email: 'newmember@example.com',
        name: 'New Member',
      } as any);
      prisma.userSpace.findUnique.mockResolvedValue(null);
      prisma.userSpace.create.mockResolvedValue({
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
        createdAt: new Date(),
        user: { id: 'user-456', email: 'newmember@example.com', name: 'New Member' },
      } as any);

      await service.inviteMember('space-123', inviteDto);

      expect(logger.log).toHaveBeenCalledWith(
        'Member invited: user-456 to space: space-123 with role: member',
        'SpacesService'
      );
    });
  });

  describe('updateMemberRole', () => {
    const updateRoleDto: UpdateMemberRoleDto = {
      role: 'admin',
    };

    it('should update member role', async () => {
      const existingMember = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
      };

      const updatedMember = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'admin',
        createdAt: new Date(),
        user: {
          id: 'user-456',
          email: 'member@example.com',
          name: 'Member User',
        },
      };

      prisma.userSpace.findUnique.mockResolvedValue(existingMember as any);
      prisma.userSpace.update.mockResolvedValue(updatedMember as any);

      const result = await service.updateMemberRole('space-123', 'user-456', updateRoleDto);

      expect(prisma.userSpace.update).toHaveBeenCalledWith({
        where: {
          userId_spaceId: { userId: 'user-456', spaceId: 'space-123' },
        },
        data: { role: 'admin' },
        include: { user: true },
      });

      expect(result.role).toBe('admin');
    });

    it('should throw NotFoundException if member not found', async () => {
      prisma.userSpace.findUnique.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('space-123', 'user-456', updateRoleDto)
      ).rejects.toThrow(new NotFoundException('Member not found'));
    });

    it('should prevent demoting the last owner', async () => {
      const lastOwner = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'owner',
      };

      prisma.userSpace.findUnique.mockResolvedValue(lastOwner as any);
      prisma.userSpace.count.mockResolvedValue(1); // Only 1 owner

      await expect(
        service.updateMemberRole('space-123', 'user-456', { role: 'member' })
      ).rejects.toThrow(new BadRequestException('Space must have at least one owner'));
    });

    it('should allow demoting owner if there are multiple owners', async () => {
      const owner = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'owner',
      };

      const updatedMember = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'admin',
        createdAt: new Date(),
        user: {
          id: 'user-456',
          email: 'member@example.com',
          name: 'Member User',
        },
      };

      prisma.userSpace.findUnique.mockResolvedValue(owner as any);
      prisma.userSpace.count.mockResolvedValue(2); // 2 owners
      prisma.userSpace.update.mockResolvedValue(updatedMember as any);

      const result = await service.updateMemberRole('space-123', 'user-456', { role: 'admin' });

      expect(result.role).toBe('admin');
    });

    it('should log role update', async () => {
      const existingMember = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
      };

      prisma.userSpace.findUnique.mockResolvedValue(existingMember as any);
      prisma.userSpace.update.mockResolvedValue({
        ...existingMember,
        role: 'admin',
        createdAt: new Date(),
        user: { id: 'user-456', email: 'member@example.com', name: 'Member' },
      } as any);

      await service.updateMemberRole('space-123', 'user-456', updateRoleDto);

      expect(logger.log).toHaveBeenCalledWith(
        'Member role updated: user-456 in space: space-123 to role: admin',
        'SpacesService'
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member from space', async () => {
      const memberToRemove = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
      };

      prisma.userSpace.findUnique.mockResolvedValue(memberToRemove as any);
      prisma.userSpace.delete.mockResolvedValue(memberToRemove as any);

      await service.removeMember('space-123', 'user-456', 'user-123');

      expect(prisma.userSpace.delete).toHaveBeenCalledWith({
        where: {
          userId_spaceId: { userId: 'user-456', spaceId: 'space-123' },
        },
      });
    });

    it('should prevent user from removing themselves', async () => {
      await expect(service.removeMember('space-123', 'user-123', 'user-123')).rejects.toThrow(
        new BadRequestException('Cannot remove yourself')
      );
    });

    it('should throw NotFoundException if member not found', async () => {
      prisma.userSpace.findUnique.mockResolvedValue(null);

      await expect(service.removeMember('space-123', 'user-456', 'user-123')).rejects.toThrow(
        new NotFoundException('Member not found')
      );
    });

    it('should prevent removing the only owner', async () => {
      const lastOwner = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'owner',
      };

      prisma.userSpace.findUnique.mockResolvedValue(lastOwner as any);
      prisma.userSpace.count.mockResolvedValue(1);

      await expect(service.removeMember('space-123', 'user-456', 'user-123')).rejects.toThrow(
        new BadRequestException('Cannot remove the only owner')
      );
    });

    it('should allow removing owner if there are multiple owners', async () => {
      const owner = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'owner',
      };

      prisma.userSpace.findUnique.mockResolvedValue(owner as any);
      prisma.userSpace.count.mockResolvedValue(2);
      prisma.userSpace.delete.mockResolvedValue(owner as any);

      await service.removeMember('space-123', 'user-456', 'user-123');

      expect(prisma.userSpace.delete).toHaveBeenCalled();
    });

    it('should log member removal', async () => {
      const member = {
        userId: 'user-456',
        spaceId: 'space-123',
        role: 'member',
      };

      prisma.userSpace.findUnique.mockResolvedValue(member as any);
      prisma.userSpace.delete.mockResolvedValue(member as any);

      await service.removeMember('space-123', 'user-456', 'user-123');

      expect(logger.log).toHaveBeenCalledWith(
        'Member removed: user-456 from space: space-123',
        'SpacesService'
      );
    });
  });

  describe('getUserRoleInSpace', () => {
    it('should return user role in space', async () => {
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
        role: 'owner',
      } as any);

      const result = await service.getUserRoleInSpace('user-123', 'space-123');

      expect(result).toBe('owner');
    });

    it('should return null if user is not a member', async () => {
      prisma.userSpace.findUnique.mockResolvedValue(null);

      const result = await service.getUserRoleInSpace('user-123', 'space-123');

      expect(result).toBeNull();
    });
  });

  describe('verifyUserAccess', () => {
    it('should allow owner full access', async () => {
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
        role: 'owner',
      } as any);

      await expect(
        service.verifyUserAccess('user-123', 'space-123', 'owner')
      ).resolves.not.toThrow();
    });

    it('should allow admin access for member-level operations', async () => {
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
        role: 'admin',
      } as any);

      await expect(
        service.verifyUserAccess('user-123', 'space-123', 'member')
      ).resolves.not.toThrow();
    });

    it('should allow member access for viewer-level operations', async () => {
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
        role: 'member',
      } as any);

      await expect(
        service.verifyUserAccess('user-123', 'space-123', 'viewer')
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException if user is not a member', async () => {
      prisma.userSpace.findUnique.mockResolvedValue(null);

      await expect(service.verifyUserAccess('user-123', 'space-123', 'viewer')).rejects.toThrow(
        new NotFoundException('Space not found or access denied')
      );
    });

    it('should throw ForbiddenException if user role is insufficient', async () => {
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
        role: 'viewer',
      } as any);

      await expect(service.verifyUserAccess('user-123', 'space-123', 'admin')).rejects.toThrow(
        new ForbiddenException('Access denied. Required role: admin, user role: viewer')
      );
    });

    it('should respect role hierarchy (owner > admin > member > viewer)', async () => {
      // Test that owner can access admin-level operations
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-owner',
        spaceId: 'space-123',
        role: 'owner',
      } as any);

      await expect(
        service.verifyUserAccess('user-owner', 'space-123', 'admin')
      ).resolves.not.toThrow();

      // Test that member cannot access admin-level operations
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-member',
        spaceId: 'space-123',
        role: 'member',
      } as any);

      await expect(service.verifyUserAccess('user-member', 'space-123', 'admin')).rejects.toThrow(
        ForbiddenException
      );

      // Test that viewer cannot access member-level operations
      prisma.userSpace.findUnique.mockResolvedValue({
        userId: 'user-viewer',
        spaceId: 'space-123',
        role: 'viewer',
      } as any);

      await expect(service.verifyUserAccess('user-viewer', 'space-123', 'member')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should ensure multi-tenant isolation (cannot access other spaces)', async () => {
      prisma.userSpace.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyUserAccess('user-from-space-A', 'space-B', 'viewer')
      ).rejects.toThrow(new NotFoundException('Space not found or access denied'));
    });
  });
});
