import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { GoalCollaborationService } from './goal-collaboration.service';

import { PrismaService } from '@/core/prisma/prisma.service';

// Mock Prisma enums
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  GoalShareRole: {
    viewer: 'viewer',
    contributor: 'contributor',
    editor: 'editor',
    manager: 'manager',
  },
  GoalShareStatus: {
    pending: 'pending',
    accepted: 'accepted',
    declined: 'declined',
    revoked: 'revoked',
  },
  GoalActivityAction: {
    shared: 'shared',
    share_accepted: 'share_accepted',
    share_declined: 'share_declined',
    updated: 'updated',
    milestone_reached: 'milestone_reached',
  },
}));

const { GoalShareRole, GoalShareStatus, GoalActivityAction } = require('@prisma/client');

describe('GoalCollaborationService', () => {
  let service: GoalCollaborationService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    goal: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    goalShare: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    goalActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalCollaborationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    // Suppress logger output
    module.useLogger(false);

    service = module.get<GoalCollaborationService>(GoalCollaborationService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('shareGoal', () => {
    const mockGoal = {
      id: 'goal-123',
      name: 'Emergency Fund',
      spaceId: 'space-123',
      space: {
        userSpaces: [{ userId: 'user-owner' }],
      },
    };

    const mockShareWithUser = {
      id: 'user-share',
      name: 'Share User',
      email: 'share@example.com',
    };

    const mockInput = {
      goalId: 'goal-123',
      shareWithEmail: 'share@example.com',
      role: 'contributor' as any,
      message: 'Help me track my emergency fund!',
    };

    it('should share goal with another user', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.user.findUnique.mockResolvedValue(mockShareWithUser);
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null); // No existing share
      mockPrismaService.goalShare.create.mockResolvedValue({
        id: 'share-123',
        goalId: 'goal-123',
        sharedWith: 'user-share',
        role: 'contributor',
        status: 'pending',
        message: 'Help me track my emergency fund!',
        user: mockShareWithUser,
        inviter: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
      });
      mockPrismaService.goal.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      const result = await service.shareGoal('user-owner', mockInput);

      expect(result.goalId).toBe('goal-123');
      expect(result.status).toBe('pending');
      expect(result.role).toBe('contributor');
      expect(mockPrismaService.goalShare.create).toHaveBeenCalled();
    });

    it('should verify goal access before sharing', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.user.findUnique.mockResolvedValue(mockShareWithUser);
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);
      mockPrismaService.goalShare.create.mockResolvedValue({});
      mockPrismaService.goal.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.shareGoal('user-owner', mockInput);

      expect(mockPrismaService.goal.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'goal-123',
          space: {
            userSpaces: {
              some: { userId: 'user-owner' },
            },
          },
        },
        include: {
          shares: {
            where: {
              sharedWith: 'user-owner',
              status: 'accepted',
            },
          },
        },
      });
    });

    it('should throw NotFoundException if user to share with not found', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.shareGoal('user-owner', mockInput)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if goal already shared with user', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.user.findUnique.mockResolvedValue(mockShareWithUser);
      mockPrismaService.goalShare.findUnique.mockResolvedValue({
        id: 'existing-share',
        goalId: 'goal-123',
        sharedWith: 'user-share',
      });

      await expect(service.shareGoal('user-owner', mockInput)).rejects.toThrow(BadRequestException);
    });

    it('should mark goal as shared and update message', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.user.findUnique.mockResolvedValue(mockShareWithUser);
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);
      mockPrismaService.goalShare.create.mockResolvedValue({});
      mockPrismaService.goal.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.shareGoal('user-owner', mockInput);

      expect(mockPrismaService.goal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: {
          isShared: true,
          sharedWithMessage: 'Help me track my emergency fund!',
        },
      });
    });

    it('should create activity record when sharing goal', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.user.findUnique.mockResolvedValue(mockShareWithUser);
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);
      mockPrismaService.goalShare.create.mockResolvedValue({});
      mockPrismaService.goal.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.shareGoal('user-owner', mockInput);

      expect(mockPrismaService.goalActivity.create).toHaveBeenCalledWith({
        data: {
          goalId: 'goal-123',
          userId: 'user-owner',
          action: 'shared',
          metadata: {
            sharedWith: 'share@example.com',
            role: 'contributor',
          },
        },
      });
    });
  });

  describe('acceptShare', () => {
    const mockShare = {
      id: 'share-123',
      goalId: 'goal-123',
      sharedWith: 'user-invited',
      status: 'pending',
      role: 'contributor',
      goal: {
        id: 'goal-123',
        name: 'Emergency Fund',
      },
      user: { id: 'user-invited', name: 'Invited User', email: 'invited@example.com' },
      inviter: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
    };

    it('should accept share invitation', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goalShare.update.mockResolvedValue({
        ...mockShare,
        status: 'accepted',
        acceptedAt: new Date(),
      });
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      const result = await service.acceptShare('user-invited', 'share-123');

      expect(result.status).toBe('accepted');
      expect(mockPrismaService.goalShare.update).toHaveBeenCalledWith({
        where: { id: 'share-123' },
        data: {
          status: 'accepted',
          acceptedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if share not found', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);

      await expect(service.acceptShare('user-invited', 'share-nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if invitation not for current user', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);

      await expect(service.acceptShare('wrong-user', 'share-123')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw BadRequestException if invitation not pending', async () => {
      const acceptedShare = { ...mockShare, status: 'accepted' };
      mockPrismaService.goalShare.findUnique.mockResolvedValue(acceptedShare);

      await expect(service.acceptShare('user-invited', 'share-123')).rejects.toThrow(
        BadRequestException
      );
    });

    it('should create activity when accepting share', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goalShare.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.acceptShare('user-invited', 'share-123');

      expect(mockPrismaService.goalActivity.create).toHaveBeenCalledWith({
        data: {
          goalId: 'goal-123',
          userId: 'user-invited',
          action: 'share_accepted',
          metadata: { shareId: 'share-123' },
        },
      });
    });
  });

  describe('declineShare', () => {
    const mockShare = {
      id: 'share-123',
      goalId: 'goal-123',
      sharedWith: 'user-invited',
      status: 'pending',
    };

    it('should decline share invitation', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goalShare.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.declineShare('user-invited', 'share-123');

      expect(mockPrismaService.goalShare.update).toHaveBeenCalledWith({
        where: { id: 'share-123' },
        data: {
          status: 'declined',
        },
      });
    });

    it('should throw NotFoundException if share not found', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);

      await expect(service.declineShare('user-invited', 'share-nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ForbiddenException if invitation not for current user', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);

      await expect(service.declineShare('wrong-user', 'share-123')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should create activity when declining share', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goalShare.update.mockResolvedValue({});
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.declineShare('user-invited', 'share-123');

      expect(mockPrismaService.goalActivity.create).toHaveBeenCalledWith({
        data: {
          goalId: 'goal-123',
          userId: 'user-invited',
          action: 'share_declined',
          metadata: { shareId: 'share-123' },
        },
      });
    });
  });

  describe('revokeShare', () => {
    const mockShare = {
      id: 'share-123',
      goalId: 'goal-123',
      sharedWith: 'user-shared',
      status: 'accepted',
      goal: {
        id: 'goal-123',
        space: {
          userSpaces: [{ userId: 'user-owner' }],
        },
      },
    };

    it('should revoke share', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goal.findFirst.mockResolvedValue(mockShare.goal);
      mockPrismaService.goalShare.update.mockResolvedValue({});

      await service.revokeShare('user-owner', 'share-123');

      expect(mockPrismaService.goalShare.update).toHaveBeenCalledWith({
        where: { id: 'share-123' },
        data: {
          status: 'revoked',
        },
      });
    });

    it('should throw NotFoundException if share not found', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);

      await expect(service.revokeShare('user-owner', 'share-nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should verify manager permission before revoking', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goal.findFirst.mockResolvedValue(mockShare.goal);
      mockPrismaService.goalShare.update.mockResolvedValue({});

      await service.revokeShare('user-owner', 'share-123');

      expect(mockPrismaService.goal.findFirst).toHaveBeenCalled();
    });
  });

  describe('updateShareRole', () => {
    const mockShare = {
      id: 'share-123',
      goalId: 'goal-123',
      sharedWith: 'user-shared',
      role: 'contributor',
      goal: {
        id: 'goal-123',
        space: {
          userSpaces: [{ userId: 'user-owner' }],
        },
      },
    };

    it('should update share role', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goal.findFirst.mockResolvedValue(mockShare.goal);
      mockPrismaService.goalShare.update.mockResolvedValue({
        ...mockShare,
        role: 'editor',
        user: { id: 'user-shared', name: 'Shared User', email: 'shared@example.com' },
        inviter: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
      });

      const result = await service.updateShareRole('user-owner', {
        shareId: 'share-123',
        newRole: 'editor' as any,
      });

      expect(result.role).toBe('editor');
      expect(mockPrismaService.goalShare.update).toHaveBeenCalledWith({
        where: { id: 'share-123' },
        data: {
          role: 'editor',
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if share not found', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(null);

      await expect(
        service.updateShareRole('user-owner', {
          shareId: 'share-nonexistent',
          newRole: 'editor' as any,
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify manager permission before updating role', async () => {
      mockPrismaService.goalShare.findUnique.mockResolvedValue(mockShare);
      mockPrismaService.goal.findFirst.mockResolvedValue(mockShare.goal);
      mockPrismaService.goalShare.update.mockResolvedValue({});

      await service.updateShareRole('user-owner', {
        shareId: 'share-123',
        newRole: 'editor' as any,
      });

      expect(mockPrismaService.goal.findFirst).toHaveBeenCalled();
    });
  });

  describe('getGoalShares', () => {
    const mockGoal = {
      id: 'goal-123',
      space: {
        userSpaces: [{ userId: 'user-owner' }],
      },
    };

    const mockShares = [
      {
        id: 'share-1',
        goalId: 'goal-123',
        role: 'editor',
        status: 'accepted',
        user: { id: 'user-1', name: 'User 1', email: 'user1@example.com' },
        inviter: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
        createdAt: new Date('2024-01-15'),
      },
      {
        id: 'share-2',
        goalId: 'goal-123',
        role: 'contributor',
        status: 'pending',
        user: { id: 'user-2', name: 'User 2', email: 'user2@example.com' },
        inviter: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
        createdAt: new Date('2024-01-10'),
      },
    ];

    it('should get all shares for a goal', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goalShare.findMany.mockResolvedValue(mockShares);

      const result = await service.getGoalShares('user-owner', 'goal-123');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.goalShare.findMany).toHaveBeenCalledWith({
        where: { goalId: 'goal-123' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          inviter: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should verify access before returning shares', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goalShare.findMany.mockResolvedValue(mockShares);

      await service.getGoalShares('user-owner', 'goal-123');

      expect(mockPrismaService.goal.findFirst).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not have access', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(null);
      mockPrismaService.goalShare.findFirst.mockResolvedValue(null);

      await expect(service.getGoalShares('unauthorized-user', 'goal-123')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getSharedGoals', () => {
    const mockShares = [
      {
        id: 'share-1',
        role: 'editor',
        goal: {
          id: 'goal-1',
          name: 'Emergency Fund',
          space: { id: 'space-1', name: 'Family Space' },
          allocations: [],
        },
        inviter: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
      },
      {
        id: 'share-2',
        role: 'contributor',
        goal: {
          id: 'goal-2',
          name: 'Vacation Savings',
          space: { id: 'space-2', name: 'Personal Space' },
          allocations: [],
        },
        inviter: { id: 'user-another', name: 'Another', email: 'another@example.com' },
      },
    ];

    it('should get all goals shared with user', async () => {
      mockPrismaService.goalShare.findMany.mockResolvedValue(mockShares);

      const result = await service.getSharedGoals('user-invited');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('goal-1');
      expect(result[0].shareRole).toBe('editor');
      expect(result[0].sharedBy.id).toBe('user-owner');
    });

    it('should only return accepted shares', async () => {
      mockPrismaService.goalShare.findMany.mockResolvedValue(mockShares);

      await service.getSharedGoals('user-invited');

      expect(mockPrismaService.goalShare.findMany).toHaveBeenCalledWith({
        where: {
          sharedWith: 'user-invited',
          status: 'accepted',
        },
        include: expect.any(Object),
        orderBy: { acceptedAt: 'desc' },
      });
    });

    it('should handle empty share list', async () => {
      mockPrismaService.goalShare.findMany.mockResolvedValue([]);

      const result = await service.getSharedGoals('user-no-shares');

      expect(result).toEqual([]);
    });
  });

  describe('getGoalActivities', () => {
    const mockGoal = {
      id: 'goal-123',
      space: {
        userSpaces: [{ userId: 'user-owner' }],
      },
    };

    const mockActivities = [
      {
        id: 'activity-1',
        action: 'shared',
        metadata: { sharedWith: 'user1@example.com' },
        createdAt: new Date('2024-01-15'),
        user: { id: 'user-owner', name: 'Owner', email: 'owner@example.com' },
      },
      {
        id: 'activity-2',
        action: 'share_accepted',
        metadata: { shareId: 'share-123' },
        createdAt: new Date('2024-01-16'),
        user: { id: 'user-invited', name: 'Invited', email: 'invited@example.com' },
      },
    ];

    it('should get goal activities with default limit', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goalActivity.findMany.mockResolvedValue(mockActivities);

      const result = await service.getGoalActivities('user-owner', 'goal-123');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.goalActivity.findMany).toHaveBeenCalledWith({
        where: { goalId: 'goal-123' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should apply custom limit to activities', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goalActivity.findMany.mockResolvedValue(mockActivities);

      await service.getGoalActivities('user-owner', 'goal-123', 10);

      expect(mockPrismaService.goalActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should verify access before returning activities', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goalActivity.findMany.mockResolvedValue(mockActivities);

      await service.getGoalActivities('user-owner', 'goal-123');

      expect(mockPrismaService.goal.findFirst).toHaveBeenCalled();
    });
  });

  describe('createActivity', () => {
    it('should create activity record', async () => {
      mockPrismaService.goalActivity.create.mockResolvedValue({
        id: 'activity-123',
        goalId: 'goal-123',
        userId: 'user-123',
        action: 'shared',
        metadata: { test: 'data' },
      });

      await service.createActivity('goal-123', 'user-123', 'shared' as any, {
        test: 'data',
      });

      expect(mockPrismaService.goalActivity.create).toHaveBeenCalledWith({
        data: {
          goalId: 'goal-123',
          userId: 'user-123',
          action: 'shared',
          metadata: { test: 'data' },
        },
      });
    });

    it('should handle activity creation without metadata', async () => {
      mockPrismaService.goalActivity.create.mockResolvedValue({});

      await service.createActivity('goal-123', 'user-123', 'shared' as any);

      expect(mockPrismaService.goalActivity.create).toHaveBeenCalledWith({
        data: {
          goalId: 'goal-123',
          userId: 'user-123',
          action: 'shared',
          metadata: undefined,
        },
      });
    });
  });

  describe('canUserAccessGoal', () => {
    const mockOwnedGoal = {
      id: 'goal-123',
      name: 'Emergency Fund',
    };

    const mockShare = {
      id: 'share-123',
      goalId: 'goal-123',
      role: 'editor',
      status: 'accepted',
    };

    it('should return manager role for goal owner', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockOwnedGoal);

      const result = await service.canUserAccessGoal('user-owner', 'goal-123');

      expect(result.canAccess).toBe(true);
      expect(result.role).toBe('manager');
      expect(result.isOwner).toBe(true);
    });

    it('should return share role for shared goal', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(null); // Not owner
      mockPrismaService.goalShare.findFirst.mockResolvedValue(mockShare);

      const result = await service.canUserAccessGoal('user-invited', 'goal-123');

      expect(result.canAccess).toBe(true);
      expect(result.role).toBe('editor');
      expect(result.isOwner).toBe(false);
    });

    it('should return no access if user has no permission', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(null);
      mockPrismaService.goalShare.findFirst.mockResolvedValue(null);

      const result = await service.canUserAccessGoal('unauthorized-user', 'goal-123');

      expect(result.canAccess).toBe(false);
      expect(result.role).toBeUndefined();
      expect(result.isOwner).toBe(false);
    });
  });

  describe('declineShare edge cases', () => {
    it('should throw BadRequestException when declining non-pending share (line 206)', async () => {
      const acceptedShare = {
        id: 'share-123',
        goalId: 'goal-123',
        sharedWith: 'user-invited',
        status: 'accepted', // Not 'pending'
      };

      mockPrismaService.goalShare.findUnique.mockResolvedValue(acceptedShare);

      await expect(service.declineShare('user-invited', 'share-123')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.declineShare('user-invited', 'share-123')).rejects.toThrow(
        'Cannot decline invitation with status: accepted'
      );
    });

    it('should throw BadRequestException when declining revoked share', async () => {
      const revokedShare = {
        id: 'share-123',
        goalId: 'goal-123',
        sharedWith: 'user-invited',
        status: 'revoked',
      };

      mockPrismaService.goalShare.findUnique.mockResolvedValue(revokedShare);

      await expect(service.declineShare('user-invited', 'share-123')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('verifyGoalAccess edge cases', () => {
    it('should throw ForbiddenException when shared role is insufficient (lines 432-438)', async () => {
      // Goal not owned by user
      mockPrismaService.goal.findFirst.mockResolvedValue(null);

      // User has shared access but with viewer role
      const shareWithViewerRole = {
        id: 'share-123',
        goalId: 'goal-123',
        sharedWith: 'user-shared',
        role: 'viewer', // Has viewer, but needs manager
        goal: {
          id: 'goal-123',
          name: 'Test Goal',
          space: { id: 'space-123' },
        },
      };
      mockPrismaService.goalShare.findFirst.mockResolvedValue(shareWithViewerRole);

      // Try to access with manager role requirement (e.g., revoking share)
      await expect(service.revokeShare('user-shared', 'share-456')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw ForbiddenException with specific message for insufficient role', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(null);

      const shareWithContributorRole = {
        id: 'share-123',
        goalId: 'goal-123',
        sharedWith: 'user-shared',
        role: 'contributor',
        goal: {
          id: 'goal-123',
          name: 'Test Goal',
          space: { id: 'space-123' },
        },
      };
      mockPrismaService.goalShare.findFirst.mockResolvedValue(shareWithContributorRole);
      mockPrismaService.goalShare.findUnique.mockResolvedValue({
        id: 'share-456',
        goalId: 'goal-123',
        goal: { id: 'goal-123' },
      });

      await expect(service.revokeShare('user-shared', 'share-456')).rejects.toThrow(
        'Insufficient permissions'
      );
    });
  });
});
