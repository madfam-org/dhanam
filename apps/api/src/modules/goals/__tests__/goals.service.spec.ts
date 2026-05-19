import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { Goal, GoalType, GoalStatus, Currency } from '@db';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateGoalDto, UpdateGoalDto, AddAllocationDto } from '../dto';
import { GoalsService } from '../goals.service';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSpace = {
    id: 'space-123',
    name: 'Personal',
    type: 'personal',
    userId: 'user-123',
  };

  const mockGoal: any = {
    id: 'goal-123',
    spaceId: 'space-123',
    householdId: null,
    name: 'Retirement Fund',
    description: 'Save for retirement',
    type: 'retirement' as GoalType,
    targetAmount: 100000,
    currency: 'USD' as Currency,
    targetDate: new Date('2030-01-01'),
    priority: 1,
    status: 'active' as GoalStatus,
    notes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAccount = {
    id: 'account-123',
    spaceId: 'space-123',
    name: 'Savings Account',
    balance: 50000,
    currency: 'USD',
    type: 'cash',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: PrismaService,
          useValue: {
            userSpace: {
              findFirst: jest.fn(),
            },
            goal: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            account: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            goalAllocation: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    audit = module.get(AuditService) as jest.Mocked<AuditService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateGoalDto = {
      spaceId: 'space-123',
      name: 'Retirement Fund',
      description: 'Save for retirement',
      type: 'retirement',
      targetAmount: 100000,
      currency: 'USD',
      targetDate: '2030-01-01',
      priority: 1,
      notes: null,
    };

    it('should create a new goal successfully', async () => {
      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.create.mockResolvedValue(mockGoal as any);

      const result = await service.create(createDto, 'user-123');

      expect(prisma.userSpace.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123', spaceId: 'space-123' },
      });
      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: 'space-123',
          name: 'Retirement Fund',
          type: 'retirement',
          targetAmount: 100000,
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'GOAL_CREATED',
        })
      );
      expect(result).toEqual(mockGoal);
    });

    it('should throw NotFoundException when user does not have access to space', async () => {
      prisma.userSpace.findFirst.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.create(createDto, 'user-123')).rejects.toThrow(
        'Space not found or you do not have access'
      );
    });

    it('should use USD as default currency', async () => {
      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.create.mockResolvedValue(mockGoal as any);

      const dtoWithoutCurrency = { ...createDto, currency: undefined };
      await service.create(dtoWithoutCurrency as any, 'user-123');

      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ currency: 'USD' }),
      });
    });

    it('should use priority 1 as default', async () => {
      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.create.mockResolvedValue(mockGoal as any);

      const dtoWithoutPriority = { ...createDto, priority: undefined };
      await service.create(dtoWithoutPriority as any, 'user-123');

      expect(prisma.goal.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ priority: 1 }),
      });
    });
  });

  describe('update', () => {
    const updateDto: UpdateGoalDto = {
      name: 'Updated Retirement Fund',
      targetAmount: 150000,
    };

    beforeEach(() => {
      // Mock findByIdWithAccess
      jest.spyOn(service as any, 'findByIdWithAccess').mockResolvedValue(mockGoal);
    });

    it('should update a goal successfully', async () => {
      const updatedGoal = { ...mockGoal, ...updateDto };
      prisma.goal.update.mockResolvedValue(updatedGoal as any);

      const result = await service.update('goal-123', updateDto, 'user-123');

      expect(service['findByIdWithAccess']).toHaveBeenCalledWith('goal-123', 'user-123');
      expect(prisma.goal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: expect.objectContaining({
          name: 'Updated Retirement Fund',
          targetAmount: 150000,
        }),
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOAL_UPDATED',
          resourceId: 'goal-123',
        })
      );
      expect(result).toEqual(updatedGoal);
    });

    it('should only update provided fields', async () => {
      prisma.goal.update.mockResolvedValue(mockGoal as any);

      await service.update('goal-123', { name: 'New Name' }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('name', 'New Name');
      expect(updateCall.data).not.toHaveProperty('targetAmount');
    });

    it('should update description when provided', async () => {
      prisma.goal.update.mockResolvedValue({ ...mockGoal, description: 'New description' } as any);

      await service.update('goal-123', { description: 'New description' }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('description', 'New description');
    });

    it('should update goal type when provided', async () => {
      prisma.goal.update.mockResolvedValue({ ...mockGoal, type: 'education' } as any);

      await service.update('goal-123', { type: 'education' }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('type', 'education');
    });

    it('should update currency when provided', async () => {
      prisma.goal.update.mockResolvedValue({ ...mockGoal, currency: 'EUR' } as any);

      await service.update('goal-123', { currency: 'EUR' }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('currency', 'EUR');
    });

    it('should update targetDate when provided', async () => {
      const newDate = '2035-01-01';
      prisma.goal.update.mockResolvedValue({ ...mockGoal, targetDate: new Date(newDate) } as any);

      await service.update('goal-123', { targetDate: newDate }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data.targetDate).toEqual(new Date(newDate));
    });

    it('should update priority when provided', async () => {
      prisma.goal.update.mockResolvedValue({ ...mockGoal, priority: 2 } as any);

      await service.update('goal-123', { priority: 2 }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('priority', 2);
    });

    it('should update status when provided', async () => {
      prisma.goal.update.mockResolvedValue({ ...mockGoal, status: 'achieved' } as any);

      await service.update('goal-123', { status: 'achieved' }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('status', 'achieved');
    });

    it('should update notes when provided', async () => {
      prisma.goal.update.mockResolvedValue({ ...mockGoal, notes: 'Some notes' } as any);

      await service.update('goal-123', { notes: 'Some notes' }, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toHaveProperty('notes', 'Some notes');
    });

    it('should handle updating all fields at once', async () => {
      const fullUpdate: UpdateGoalDto = {
        name: 'Full Update Goal',
        description: 'Full description',
        type: 'emergency',
        targetAmount: 200000,
        currency: 'MXN',
        targetDate: '2040-12-31',
        priority: 3,
        status: 'paused',
        notes: 'Important notes',
      };

      prisma.goal.update.mockResolvedValue({ ...mockGoal, ...fullUpdate } as any);

      await service.update('goal-123', fullUpdate, 'user-123');

      const updateCall = prisma.goal.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({
        name: 'Full Update Goal',
        description: 'Full description',
        type: 'emergency',
        targetAmount: 200000,
        currency: 'MXN',
        priority: 3,
        status: 'paused',
        notes: 'Important notes',
      });
      expect(updateCall.data.targetDate).toEqual(new Date('2040-12-31'));
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      jest.spyOn(service as any, 'findByIdWithAccess').mockResolvedValue(mockGoal);
    });

    it('should delete a goal successfully', async () => {
      prisma.goal.delete.mockResolvedValue(mockGoal as any);

      await service.delete('goal-123', 'user-123');

      expect(service['findByIdWithAccess']).toHaveBeenCalledWith('goal-123', 'user-123');
      expect(prisma.goal.delete).toHaveBeenCalledWith({ where: { id: 'goal-123' } });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOAL_DELETED',
          resourceId: 'goal-123',
        })
      );
    });
  });

  describe('findById', () => {
    it('should return a goal with allocations', async () => {
      const goalWithAllocations = {
        ...mockGoal,
        allocations: [
          {
            id: 'alloc-1',
            goalId: 'goal-123',
            accountId: 'account-123',
            percentage: 50,
            account: mockAccount,
          },
        ],
      };

      // Mock findByIdWithAccess (called internally)
      jest.spyOn(service as any, 'findByIdWithAccess').mockResolvedValue(mockGoal);
      // Mock the final findUnique call
      prisma.goal.findUnique.mockResolvedValue(goalWithAllocations as any);

      const result = await service.findById('goal-123', 'user-123');

      expect(result).toEqual(goalWithAllocations);
      expect(result.allocations).toHaveLength(1);
    });

    it('should throw NotFoundException when goal does not exist', async () => {
      jest
        .spyOn(service as any, 'findByIdWithAccess')
        .mockRejectedValue(new NotFoundException('Goal not found'));

      await expect(service.findById('nonexistent', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when goal is null after access check', async () => {
      // Mock access check passes but goal findUnique returns null (edge case)
      jest.spyOn(service as any, 'findByIdWithAccess').mockResolvedValue(mockGoal);
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.findById('goal-123', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findById('goal-123', 'user-123')).rejects.toThrow('Goal not found');
    });
  });

  describe('findBySpace', () => {
    it('should return all goals for a space', async () => {
      const goals = [mockGoal, { ...mockGoal, id: 'goal-456', name: 'Education Fund' }];

      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.findMany.mockResolvedValue(goals as any);

      const result = await service.findBySpace('space-123', 'user-123');

      expect(result).toEqual(goals);
      expect(result).toHaveLength(2);
    });

    it('should order goals by priority and target date', async () => {
      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.findMany.mockResolvedValue([mockGoal] as any);

      await service.findBySpace('space-123', 'user-123');

      expect(prisma.goal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ priority: 'asc' }, { targetDate: 'asc' }],
        })
      );
    });

    it('should throw NotFoundException when user does not have access to space', async () => {
      prisma.userSpace.findFirst.mockResolvedValue(null);

      await expect(service.findBySpace('space-123', 'user-123')).rejects.toThrow(NotFoundException);
      await expect(service.findBySpace('space-123', 'user-123')).rejects.toThrow(
        'Space not found or you do not have access'
      );
    });
  });

  describe('addAllocation', () => {
    const addAllocationDto: AddAllocationDto = {
      accountId: 'account-123',
      percentage: 50,
      notes: null,
    };

    beforeEach(() => {
      jest.spyOn(service as any, 'findByIdWithAccess').mockResolvedValue(mockGoal);
    });

    it('should add allocation successfully', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.goalAllocation.findUnique.mockResolvedValue(null);
      prisma.goalAllocation.findMany.mockResolvedValue([]);
      prisma.goalAllocation.create.mockResolvedValue({
        id: 'alloc-1',
        goalId: 'goal-123',
        accountId: 'account-123',
        percentage: 50,
        notes: null,
        createdAt: new Date(),
      } as any);

      const result = await service.addAllocation('goal-123', addAllocationDto, 'user-123');

      expect(prisma.goalAllocation.create).toHaveBeenCalledWith({
        data: {
          goalId: 'goal-123',
          accountId: 'account-123',
          percentage: 50,
          notes: null,
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOAL_ALLOCATION_ADDED',
        })
      );
      expect(result).toBeDefined();
    });

    it('should throw error when account does not exist', async () => {
      prisma.account.findFirst.mockResolvedValue(null);

      await expect(service.addAllocation('goal-123', addAllocationDto, 'user-123')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.addAllocation('goal-123', addAllocationDto, 'user-123')).rejects.toThrow(
        'Account not found or does not belong to this space'
      );
    });

    it('should throw error when allocation already exists', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.goalAllocation.findUnique.mockResolvedValue({
        id: 'existing-alloc',
        goalId: 'goal-123',
        accountId: 'account-123',
      } as any);

      await expect(service.addAllocation('goal-123', addAllocationDto, 'user-123')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.addAllocation('goal-123', addAllocationDto, 'user-123')).rejects.toThrow(
        'Allocation already exists for this account'
      );
    });

    it('should throw error when total allocation exceeds 100%', async () => {
      prisma.account.findFirst.mockResolvedValue(mockAccount as any);
      prisma.goalAllocation.findUnique.mockResolvedValue(null);
      prisma.goalAllocation.findMany.mockResolvedValue([
        {
          id: 'alloc-1',
          percentage: 60,
        },
      ] as any);

      await expect(service.addAllocation('goal-123', addAllocationDto, 'user-123')).rejects.toThrow(
        BadRequestException
      );
      await expect(service.addAllocation('goal-123', addAllocationDto, 'user-123')).rejects.toThrow(
        /Total allocation percentage would exceed 100%/
      );
    });
  });

  describe('removeAllocation', () => {
    beforeEach(() => {
      jest.spyOn(service as any, 'findByIdWithAccess').mockResolvedValue(mockGoal);
    });

    it('should remove allocation successfully', async () => {
      const mockAllocation = {
        id: 'alloc-1',
        goalId: 'goal-123',
        accountId: 'account-123',
      };

      prisma.goalAllocation.findUnique.mockResolvedValue(mockAllocation as any);
      prisma.goalAllocation.delete.mockResolvedValue(mockAllocation as any);

      await service.removeAllocation('goal-123', 'account-123', 'user-123');

      expect(prisma.goalAllocation.delete).toHaveBeenCalledWith({
        where: {
          goalId_accountId: {
            goalId: 'goal-123',
            accountId: 'account-123',
          },
        },
      });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOAL_ALLOCATION_REMOVED',
        })
      );
    });

    it('should throw NotFoundException when allocation does not exist', async () => {
      prisma.goalAllocation.findUnique.mockResolvedValue(null);

      await expect(service.removeAllocation('goal-123', 'account-123', 'user-123')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.removeAllocation('goal-123', 'account-123', 'user-123')).rejects.toThrow(
        'Allocation not found'
      );
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress correctly', async () => {
      const goalWithAllocations = {
        ...mockGoal,
        targetAmount: 100000,
        createdAt: new Date('2024-01-01'),
        targetDate: new Date('2030-01-01'),
        allocations: [
          {
            id: 'alloc-1',
            percentage: 50,
            account: {
              id: 'account-1',
              name: 'Savings',
              balance: 40000,
            },
          },
          {
            id: 'alloc-2',
            percentage: 50,
            account: {
              id: 'account-2',
              name: 'Investment',
              balance: 30000,
            },
          },
        ],
      };

      jest.spyOn(service, 'findById').mockResolvedValue(goalWithAllocations as any);

      const result = await service.calculateProgress('goal-123', 'user-123');

      // Current value = (40000 * 0.5) + (30000 * 0.5) = 35000
      expect(result.currentValue).toBe(35000);
      expect(result.percentComplete).toBe(35); // 35000 / 100000 * 100
      expect(result.allocations).toHaveLength(2);
      expect(result.goalName).toBe('Retirement Fund');
    });

    it('should mark goal as on track when progress meets time', async () => {
      const goalWithAllocations = {
        ...mockGoal,
        targetAmount: 100000,
        createdAt: new Date('2020-01-01'),
        targetDate: new Date('2030-01-01'),
        allocations: [
          {
            id: 'alloc-1',
            percentage: 100,
            account: {
              id: 'account-1',
              name: 'Savings',
              balance: 60000,
            },
          },
        ],
      };

      jest.spyOn(service, 'findById').mockResolvedValue(goalWithAllocations as any);

      const result = await service.calculateProgress('goal-123', 'user-123');

      expect(result.currentValue).toBe(60000);
      expect(result.percentComplete).toBe(60);
      expect(result.onTrack).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should calculate goal summary correctly', async () => {
      const goals = [
        {
          ...mockGoal,
          status: 'active',
          targetAmount: 100000,
          allocations: [
            {
              percentage: 100,
              account: { balance: 50000 },
            },
          ],
        },
        {
          ...mockGoal,
          id: 'goal-456',
          status: 'achieved',
          targetAmount: 20000,
          allocations: [
            {
              percentage: 100,
              account: { balance: 20000 },
            },
          ],
        },
      ];

      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.findMany.mockResolvedValue(goals as any);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalGoals).toBe(2);
      expect(result.activeGoals).toBe(1);
      expect(result.achievedGoals).toBe(1);
      expect(result.totalTargetAmount).toBe(120000);
      expect(result.totalCurrentValue).toBe(70000);
      expect(result.overallProgress).toBeCloseTo(58.33, 1); // 70000 / 120000 * 100
    });

    it('should return zero values for empty goal list', async () => {
      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.findMany.mockResolvedValue([]);

      const result = await service.getSummary('space-123', 'user-123');

      expect(result.totalGoals).toBe(0);
      expect(result.activeGoals).toBe(0);
      expect(result.achievedGoals).toBe(0);
      expect(result.totalTargetAmount).toBe(0);
      expect(result.totalCurrentValue).toBe(0);
      expect(result.overallProgress).toBe(0);
    });
  });

  describe('findByIdWithAccess (private method via public API)', () => {
    it('should throw NotFoundException when goal does not exist', async () => {
      // Don't mock findByIdWithAccess - let it run naturally
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'Test' }, 'user-123')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.update('nonexistent', { name: 'Test' }, 'user-123')).rejects.toThrow(
        'Goal not found'
      );
    });

    it('should throw NotFoundException when user does not have access to goal space', async () => {
      // Goal exists but user has no access to its space
      prisma.goal.findUnique.mockResolvedValue(mockGoal as any);
      prisma.userSpace.findFirst.mockResolvedValue(null);

      await expect(service.update('goal-123', { name: 'Test' }, 'user-456')).rejects.toThrow(
        NotFoundException
      );
      await expect(service.update('goal-123', { name: 'Test' }, 'user-456')).rejects.toThrow(
        'Goal not found or you do not have access'
      );
    });

    it('should succeed when goal exists and user has access', async () => {
      prisma.goal.findUnique.mockResolvedValue(mockGoal as any);
      prisma.userSpace.findFirst.mockResolvedValue({
        userId: 'user-123',
        spaceId: 'space-123',
      } as any);
      prisma.goal.update.mockResolvedValue({ ...mockGoal, name: 'Updated' } as any);

      const result = await service.update('goal-123', { name: 'Updated' }, 'user-123');

      expect(result.name).toBe('Updated');
    });
  });
});
