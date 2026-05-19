import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { BillingService } from '../../billing/billing.service';

// Mock Prisma client enums before importing anything that uses them
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  GoalType: {
    retirement: 'retirement',
    education: 'education',
    house_purchase: 'house_purchase',
    emergency_fund: 'emergency_fund',
    legacy: 'legacy',
    travel: 'travel',
    business: 'business',
    other: 'other',
  },
  Currency: {
    USD: 'USD',
    EUR: 'EUR',
    MXN: 'MXN',
  },
  GoalStatus: {
    active: 'active',
    paused: 'paused',
    achieved: 'achieved',
    abandoned: 'abandoned',
  },
}));

import { GoalCollaborationService } from '../goal-collaboration.service';
import { GoalProbabilityService } from '../goal-probability.service';
import { GoalsExecutionService } from '../goals-execution.service';
import { GoalsController } from '../goals.controller';
import { GoalsService } from '../goals.service';

// Define DTO types inline to avoid import issues with decorators
type CreateGoalDto = {
  spaceId: string;
  name: string;
  description?: string;
  type: string;
  targetAmount: number;
  currency?: string;
  targetDate: string;
  priority?: number;
  notes?: string | null;
};

type UpdateGoalDto = {
  name?: string;
  description?: string;
  type?: string;
  targetAmount?: number;
  currency?: string;
  targetDate?: string;
  priority?: number;
  status?: string;
  notes?: string | null;
};

type AddAllocationDto = {
  accountId: string;
  percentage: number;
  notes?: string | null;
};

describe('GoalsController', () => {
  let controller: GoalsController;
  let goalsService: jest.Mocked<GoalsService>;
  let goalsExecutionService: jest.Mocked<GoalsExecutionService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockGoal = {
    id: 'goal-123',
    spaceId: 'space-123',
    name: 'Retirement Fund',
    description: 'Save for retirement',
    type: 'retirement',
    targetAmount: 100000,
    currency: 'USD',
    targetDate: new Date('2030-01-01'),
    priority: 1,
    status: 'active',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    allocations: [],
  };

  const mockGoalProgress = {
    goalId: 'goal-123',
    goalName: 'Retirement Fund',
    targetAmount: 100000,
    currency: 'USD',
    currentValue: 50000,
    percentComplete: 50,
    timeProgress: 40,
    projectedCompletion: new Date('2029-01-01'),
    onTrack: true,
    monthlyContributionNeeded: 1000,
    allocations: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        {
          provide: GoalsService,
          useValue: {
            create: jest.fn(),
            findBySpace: jest.fn(),
            getSummary: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            calculateProgress: jest.fn(),
            addAllocation: jest.fn(),
            removeAllocation: jest.fn(),
          },
        },
        {
          provide: GoalsExecutionService,
          useValue: {
            calculateGoalProgress: jest.fn(),
            suggestRebalancing: jest.fn(),
            executeGoalRebalancing: jest.fn(),
          },
        },
        {
          provide: GoalProbabilityService,
          useValue: {
            calculateSuccessProbability: jest.fn(),
            runMonteCarloSimulation: jest.fn(),
            analyzeScenarios: jest.fn(),
          },
        },
        {
          provide: GoalCollaborationService,
          useValue: {
            createInvitation: jest.fn(),
            acceptInvitation: jest.fn(),
            revokeAccess: jest.fn(),
            getCollaborators: jest.fn(),
            updatePermissions: jest.fn(),
          },
        },
        {
          provide: BillingService,
          useValue: {
            checkUsageLimit: jest.fn().mockResolvedValue(true),
            recordUsage: jest.fn(),
            getUsageMetrics: jest.fn(),
          },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<GoalsController>(GoalsController);
    goalsService = module.get(GoalsService) as jest.Mocked<GoalsService>;
    goalsExecutionService = module.get(GoalsExecutionService) as jest.Mocked<GoalsExecutionService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /goals', () => {
    it('should create a new goal', async () => {
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

      const mockRequest = { user: mockUser };

      goalsService.create.mockResolvedValue(mockGoal as any);

      const result = await controller.create(createDto, mockRequest);

      expect(goalsService.create).toHaveBeenCalledWith(createDto, 'user-123');
      expect(result).toEqual(mockGoal);
    });
  });

  describe('GET /goals/space/:spaceId', () => {
    it('should return all goals for a space', async () => {
      const mockGoals = [mockGoal, { ...mockGoal, id: 'goal-456', name: 'Education Fund' }];
      const mockRequest = { user: mockUser };

      goalsService.findBySpace.mockResolvedValue(mockGoals as any);

      const result = await controller.findBySpace('space-123', mockRequest);

      expect(goalsService.findBySpace).toHaveBeenCalledWith('space-123', 'user-123');
      expect(result).toEqual(mockGoals);
    });
  });

  describe('GET /goals/space/:spaceId/summary', () => {
    it('should return goal summary for a space', async () => {
      const mockSummary = {
        totalGoals: 2,
        activeGoals: 2,
        achievedGoals: 0,
        totalTargetAmount: 150000,
        totalCurrentValue: 75000,
        overallProgress: 50,
      };

      const mockRequest = { user: mockUser };

      goalsService.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary('space-123', mockRequest);

      expect(goalsService.getSummary).toHaveBeenCalledWith('space-123', 'user-123');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('GET /goals/:id', () => {
    it('should return a specific goal by ID', async () => {
      const mockRequest = { user: mockUser };

      goalsService.findById.mockResolvedValue(mockGoal as any);

      const result = await controller.findById('goal-123', mockRequest);

      expect(goalsService.findById).toHaveBeenCalledWith('goal-123', 'user-123');
      expect(result).toEqual(mockGoal);
    });
  });

  describe('PUT /goals/:id', () => {
    it('should update a goal', async () => {
      const updateDto: UpdateGoalDto = {
        name: 'Updated Retirement Fund',
        targetAmount: 150000,
      };

      const mockRequest = { user: mockUser };
      const updatedGoal = { ...mockGoal, ...updateDto };

      goalsService.update.mockResolvedValue(updatedGoal as any);

      const result = await controller.update('goal-123', updateDto, mockRequest);

      expect(goalsService.update).toHaveBeenCalledWith('goal-123', updateDto, 'user-123');
      expect(result).toEqual(updatedGoal);
    });
  });

  describe('DELETE /goals/:id', () => {
    it('should delete a goal', async () => {
      const mockRequest = { user: mockUser };

      goalsService.delete.mockResolvedValue(undefined);

      await controller.delete('goal-123', mockRequest);

      expect(goalsService.delete).toHaveBeenCalledWith('goal-123', 'user-123');
    });
  });

  describe('GET /goals/:id/progress', () => {
    it('should return goal progress', async () => {
      const mockRequest = { user: mockUser };

      goalsService.calculateProgress.mockResolvedValue(mockGoalProgress as any);

      const result = await controller.getProgress('goal-123', mockRequest);

      expect(goalsService.calculateProgress).toHaveBeenCalledWith('goal-123', 'user-123');
      expect(result).toEqual(mockGoalProgress);
    });
  });

  describe('POST /goals/:id/allocations', () => {
    it('should add an allocation to a goal', async () => {
      const addAllocationDto: AddAllocationDto = {
        accountId: 'account-123',
        percentage: 50,
        notes: null,
      };

      const mockRequest = { user: mockUser };
      const mockAllocation = {
        id: 'alloc-1',
        goalId: 'goal-123',
        accountId: 'account-123',
        percentage: 50,
        notes: null,
        createdAt: new Date(),
      };

      goalsService.addAllocation.mockResolvedValue(mockAllocation as any);

      const result = await controller.addAllocation('goal-123', addAllocationDto, mockRequest);

      expect(goalsService.addAllocation).toHaveBeenCalledWith(
        'goal-123',
        addAllocationDto,
        'user-123'
      );
      expect(result).toEqual(mockAllocation);
    });
  });

  describe('DELETE /goals/:id/allocations/:accountId', () => {
    it('should remove an allocation from a goal', async () => {
      const mockRequest = { user: mockUser };

      goalsService.removeAllocation.mockResolvedValue(undefined);

      await controller.removeAllocation('goal-123', 'account-123', mockRequest);

      expect(goalsService.removeAllocation).toHaveBeenCalledWith(
        'goal-123',
        'account-123',
        'user-123'
      );
    });
  });

  describe('GET /goals/:id/progress/detailed', () => {
    it('should return detailed goal progress with rebalancing info', async () => {
      const mockDetailedProgress = {
        goalId: 'goal-123',
        goalName: 'Retirement Fund',
        currentValue: 100000,
        targetValue: 100000,
        progress: 100,
        daysRemaining: 180,
        monthsRemaining: 6,
        requiredMonthlyContribution: 0,
        onTrack: true,
        allocations: [
          {
            accountId: 'account-1',
            accountName: 'Savings',
            targetPercentage: 50,
            currentValue: 50000,
            targetValue: 50000,
          },
        ],
      };

      const mockRequest = { user: mockUser };

      goalsExecutionService.calculateGoalProgress.mockResolvedValue(mockDetailedProgress);

      const result = await controller.getDetailedProgress('goal-123', mockRequest);

      expect(goalsExecutionService.calculateGoalProgress).toHaveBeenCalledWith('goal-123');
      expect(result).toEqual(mockDetailedProgress);
    });
  });

  describe('GET /goals/:id/rebalancing/suggest', () => {
    it('should return rebalancing suggestions', async () => {
      const mockSuggestions = {
        goalId: 'goal-123',
        goalName: 'Retirement Fund',
        actions: [
          {
            goalId: 'goal-123',
            goalName: 'Retirement Fund',
            accountId: 'account-1',
            action: 'buy' as const,
            amount: 10000,
            reason: 'Drift of 20.00% detected',
          },
        ],
        summary: {
          totalActions: 1,
          buyActions: 1,
          sellActions: 0,
          estimatedValue: 10000,
        },
      };

      const mockRequest = { user: mockUser };

      goalsExecutionService.suggestRebalancing.mockResolvedValue(mockSuggestions);

      const result = await controller.suggestRebalancing('goal-123', mockRequest);

      expect(goalsExecutionService.suggestRebalancing).toHaveBeenCalledWith('goal-123', 'user-123');
      expect(result).toEqual(mockSuggestions);
    });
  });

  describe('POST /goals/:id/rebalancing/execute', () => {
    it('should execute rebalancing for a goal', async () => {
      const mockExecutionResult = {
        message: 'Created 2 rebalancing orders',
        actions: [
          {
            goalId: 'goal-123',
            goalName: 'Retirement Fund',
            accountId: 'account-1',
            action: 'buy' as const,
            amount: 10000,
            reason: 'Drift of 20.00% detected',
          },
          {
            goalId: 'goal-123',
            goalName: 'Retirement Fund',
            accountId: 'account-2',
            action: 'sell' as const,
            amount: 10000,
            reason: 'Drift of 20.00% detected',
          },
        ],
      };

      const mockRequest = { user: mockUser };

      goalsExecutionService.executeGoalRebalancing.mockResolvedValue(mockExecutionResult);

      const result = await controller.executeRebalancing('goal-123', mockRequest);

      expect(goalsExecutionService.executeGoalRebalancing).toHaveBeenCalledWith(
        'goal-123',
        'user-123'
      );
      expect(result).toEqual(mockExecutionResult);
    });

    it('should return message when goal is balanced', async () => {
      const mockBalancedResult = {
        message: 'Goal is already balanced, no actions needed',
        actions: [],
      };

      const mockRequest = { user: mockUser };

      goalsExecutionService.executeGoalRebalancing.mockResolvedValue(mockBalancedResult);

      const result = await controller.executeRebalancing('goal-123', mockRequest);

      expect(result).toEqual(mockBalancedResult);
      expect(result.actions).toHaveLength(0);
    });
  });
});
