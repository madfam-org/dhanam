import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProviderFactoryService } from '../../transaction-execution/providers/provider-factory.service';
import { TransactionExecutionService } from '../../transaction-execution/transaction-execution.service';
import { GoalsExecutionService, RebalancingAction } from '../goals-execution.service';

describe('GoalsExecutionService', () => {
  let service: GoalsExecutionService;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditService>;
  let transactionExecution: jest.Mocked<TransactionExecutionService>;
  let providerFactory: jest.Mocked<ProviderFactoryService>;

  const mockGoal = {
    id: 'goal-123',
    spaceId: 'space-123',
    name: 'Retirement Fund',
    targetAmount: 100000,
    status: 'active',
    allocations: [
      {
        id: 'alloc-1',
        accountId: 'account-1',
        percentage: 50,
        account: {
          id: 'account-1',
          name: 'Savings',
          balance: 40000,
          currency: 'USD',
          provider: 'plaid',
        },
      },
      {
        id: 'alloc-2',
        accountId: 'account-2',
        percentage: 50,
        account: {
          id: 'account-2',
          name: 'Investment',
          balance: 60000,
          currency: 'USD',
          provider: 'plaid',
        },
      },
    ],
    space: {
      userSpaces: [
        {
          user: {
            id: 'user-123',
            email: 'test@example.com',
          },
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsExecutionService,
        {
          provide: PrismaService,
          useValue: {
            goal: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            account: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TransactionExecutionService,
          useValue: {
            createOrder: jest.fn(),
          },
        },
        {
          provide: ProviderFactoryService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GoalsExecutionService>(GoalsExecutionService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    audit = module.get(AuditService) as jest.Mocked<AuditService>;
    transactionExecution = module.get(
      TransactionExecutionService
    ) as jest.Mocked<TransactionExecutionService>;
    providerFactory = module.get(ProviderFactoryService) as jest.Mocked<ProviderFactoryService>;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    jest.clearAllMocks();

    // Default mock for account.findMany to return mock accounts from goal allocations
    prisma.account.findMany.mockResolvedValue([
      mockGoal.allocations[0].account,
      mockGoal.allocations[1].account,
    ] as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeGoalRebalancing', () => {
    it('should return empty actions when goal has no allocations', async () => {
      const goalWithoutAllocations = { ...mockGoal, allocations: [] };

      const actions = await service.analyzeGoalRebalancing(goalWithoutAllocations);

      expect(actions).toEqual([]);
    });

    it('should detect rebalancing need when allocation drifts over threshold', async () => {
      // Account 1: 40,000 / 50,000 target = 20% drift (over 5% threshold)
      // Account 2: 60,000 / 50,000 target = 20% drift (over 5% threshold)
      const actions = await service.analyzeGoalRebalancing(mockGoal);

      expect(actions).toHaveLength(2);
      expect(actions[0]).toMatchObject({
        goalId: 'goal-123',
        goalName: 'Retirement Fund',
        accountId: 'account-1',
        action: 'buy',
        amount: 10000, // 50000 - 40000
      });
      expect(actions[1]).toMatchObject({
        goalId: 'goal-123',
        accountId: 'account-2',
        action: 'sell',
        amount: 10000, // 60000 - 50000
      });
    });

    it('should not generate actions when allocation is within threshold', async () => {
      const balancedGoal = {
        ...mockGoal,
        allocations: [
          {
            ...mockGoal.allocations[0],
            account: {
              ...mockGoal.allocations[0].account,
              balance: 49500, // Only 1% drift
            },
          },
        ],
      };

      const actions = await service.analyzeGoalRebalancing(balancedGoal);

      expect(actions).toEqual([]);
    });

    it('should include asset symbol in action when available', async () => {
      const goalWithCrypto = {
        ...mockGoal,
        allocations: [
          {
            ...mockGoal.allocations[0],
            account: {
              ...mockGoal.allocations[0].account,
              metadata: { cryptoCurrency: 'BTC' },
            },
          },
        ],
      };

      const actions = await service.analyzeGoalRebalancing(goalWithCrypto);

      if (actions.length > 0) {
        expect(actions[0].assetSymbol).toBe('BTC');
      }
    });

    it('should call executeRebalancingActions when actions are generated', async () => {
      const executeRebalancingSpy = jest
        .spyOn(service as any, 'executeRebalancingActions')
        .mockResolvedValue(undefined);

      await service.analyzeGoalRebalancing(mockGoal);

      expect(executeRebalancingSpy).toHaveBeenCalledWith(mockGoal, expect.any(Array));
    });
  });

  describe('calculateGoalProgress', () => {
    it('should calculate goal progress correctly', async () => {
      prisma.goal.findUnique.mockResolvedValue(mockGoal as any);

      const result = await service.calculateGoalProgress('goal-123');

      expect(result.currentValue).toBe(100000); // 40000 + 60000
      expect(result.targetValue).toBe(100000);
      expect(result.progress).toBe(100); // 100000 / 100000 * 100
      expect(result.goalName).toBe('Retirement Fund');
      expect(result.allocations).toHaveLength(2);
    });

    it('should throw error when goal not found', async () => {
      prisma.goal.findUnique.mockResolvedValue(null);

      await expect(service.calculateGoalProgress('nonexistent')).rejects.toThrow('Goal not found');
    });

    it('should calculate required monthly contribution', async () => {
      const goalInProgress = {
        ...mockGoal,
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        allocations: [
          {
            ...mockGoal.allocations[0],
            account: {
              ...mockGoal.allocations[0].account,
              balance: 50000,
            },
          },
        ],
      };

      prisma.goal.findUnique.mockResolvedValue(goalInProgress as any);

      const result = await service.calculateGoalProgress('goal-123');

      expect(result.currentValue).toBe(50000);
      expect(result.requiredMonthlyContribution).toBeGreaterThan(0);
      expect(result.monthsRemaining).toBeGreaterThan(0);
    });

    it('should mark goal as on track when progress is ahead of timeline', async () => {
      const goalAheadOfSchedule = {
        ...mockGoal,
        createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months ago
        targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
        allocations: [
          {
            ...mockGoal.allocations[0],
            account: {
              ...mockGoal.allocations[0].account,
              balance: 60000,
            },
          },
        ],
      };

      prisma.goal.findUnique.mockResolvedValue(goalAheadOfSchedule as any);

      const result = await service.calculateGoalProgress('goal-123');

      expect(result.currentValue).toBe(60000);
      expect(result.progress).toBe(60);
      expect(result.onTrack).toBe(true);
    });

    it('should calculate allocation details correctly', async () => {
      prisma.goal.findUnique.mockResolvedValue(mockGoal as any);

      const result = await service.calculateGoalProgress('goal-123');

      expect(result.allocations[0]).toMatchObject({
        accountId: 'account-1',
        accountName: 'Savings',
        targetPercentage: 50,
        currentValue: 40000,
        targetValue: 50000, // 100000 * 50%
      });
      expect(result.allocations[1]).toMatchObject({
        accountId: 'account-2',
        accountName: 'Investment',
        targetPercentage: 50,
        currentValue: 60000,
        targetValue: 50000,
      });
    });
  });

  describe('suggestRebalancing', () => {
    it('should return rebalancing suggestions for a goal', async () => {
      prisma.goal.findFirst.mockResolvedValue(mockGoal as any);

      const result = await service.suggestRebalancing('goal-123', 'user-123');

      expect(result.goalId).toBe('goal-123');
      expect(result.goalName).toBe('Retirement Fund');
      expect(result.actions).toHaveLength(2);
      expect(result.summary.totalActions).toBe(2);
      expect(result.summary.buyActions).toBe(1);
      expect(result.summary.sellActions).toBe(1);
      expect(result.summary.estimatedValue).toBe(20000); // 10000 + 10000
    });

    it('should throw error when goal not found', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);

      await expect(service.suggestRebalancing('nonexistent', 'user-123')).rejects.toThrow(
        'Goal not found or access denied'
      );
    });

    it('should filter goals by userId for access control', async () => {
      prisma.goal.findFirst.mockResolvedValue(mockGoal as any);

      await service.suggestRebalancing('goal-123', 'user-123');

      expect(prisma.goal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'goal-123',
            space: {
              userSpaces: {
                some: { userId: 'user-123' },
              },
            },
          }),
        })
      );
    });

    it('should return empty actions when goal is balanced', async () => {
      const balancedGoal = {
        ...mockGoal,
        allocations: [
          {
            ...mockGoal.allocations[0],
            account: {
              ...mockGoal.allocations[0].account,
              balance: 50000,
            },
          },
        ],
      };

      prisma.goal.findFirst.mockResolvedValue(balancedGoal as any);

      const result = await service.suggestRebalancing('goal-123', 'user-123');

      expect(result.actions).toHaveLength(0);
      expect(result.summary.totalActions).toBe(0);
    });
  });

  describe('executeGoalRebalancing', () => {
    it('should execute rebalancing for unbalanced goal', async () => {
      jest.clearAllMocks(); // Clear any previous test calls

      prisma.goal.findFirst.mockResolvedValue(mockGoal as any);
      // Mock account.findMany for batch account lookup (N+1 fix)
      prisma.account.findMany.mockResolvedValue([
        mockGoal.allocations[0].account,
        mockGoal.allocations[1].account,
      ] as any);
      // Mock account.findUnique for both allocations
      prisma.account.findUnique
        .mockResolvedValueOnce(mockGoal.allocations[0].account as any)
        .mockResolvedValueOnce(mockGoal.allocations[1].account as any);
      transactionExecution.createOrder.mockResolvedValue({ id: 'order-123' } as any);

      const result = await service.executeGoalRebalancing('goal-123', 'user-123');

      expect(result.message).toContain('Created 2 rebalancing orders');
      expect(result.actions).toHaveLength(2);
      expect(transactionExecution.createOrder).toHaveBeenCalledTimes(2);
      expect(audit.log).toHaveBeenCalledTimes(2);
    });

    it('should return message when goal is already balanced', async () => {
      const balancedGoal = {
        ...mockGoal,
        allocations: [
          {
            ...mockGoal.allocations[0],
            account: {
              ...mockGoal.allocations[0].account,
              balance: 50000,
            },
          },
        ],
      };

      prisma.goal.findFirst.mockResolvedValue(balancedGoal as any);

      const result = await service.executeGoalRebalancing('goal-123', 'user-123');

      expect(result.message).toBe('Goal is already balanced, no actions needed');
      expect(result.actions).toEqual([]);
      expect(transactionExecution.createOrder).not.toHaveBeenCalled();
    });

    it('should create orders with correct parameters', async () => {
      prisma.goal.findFirst.mockResolvedValue(mockGoal as any);
      prisma.account.findUnique.mockResolvedValue(mockGoal.allocations[0].account as any);
      transactionExecution.createOrder.mockResolvedValue({ id: 'order-123' } as any);

      await service.executeGoalRebalancing('goal-123', 'user-123');

      expect(transactionExecution.createOrder).toHaveBeenCalledWith(
        'space-123',
        'user-123',
        expect.objectContaining({
          accountId: expect.any(String),
          type: expect.any(String),
          amount: expect.any(Number),
          autoExecute: true,
          goalId: 'goal-123',
        }),
        undefined,
        'dhanam-auto-rebalance'
      );
    });

    it('should audit rebalancing actions', async () => {
      prisma.goal.findFirst.mockResolvedValue(mockGoal as any);
      prisma.account.findUnique.mockResolvedValue(mockGoal.allocations[0].account as any);
      transactionExecution.createOrder.mockResolvedValue({ id: 'order-123' } as any);

      await service.executeGoalRebalancing('goal-123', 'user-123');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'goal_auto_rebalance',
          resource: 'goal',
          resourceId: 'goal-123',
          severity: 'high',
        })
      );
    });

    it('should throw error when goal not found', async () => {
      prisma.goal.findFirst.mockResolvedValue(null);

      await expect(service.executeGoalRebalancing('nonexistent', 'user-123')).rejects.toThrow(
        'Goal not found or access denied'
      );
    });
  });

  describe('analyzeGoalsForRebalancing (Cron)', () => {
    it('should analyze all active goals', async () => {
      const activeGoals = [mockGoal, { ...mockGoal, id: 'goal-456', name: 'Education Fund' }];

      prisma.goal.findMany.mockResolvedValue(activeGoals as any);
      const analyzeGoalSpy = jest.spyOn(service, 'analyzeGoalRebalancing').mockResolvedValue([]);

      await service.analyzeGoalsForRebalancing();

      expect(prisma.goal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        })
      );
      expect(analyzeGoalSpy).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other goals when one fails', async () => {
      const activeGoals = [mockGoal, { ...mockGoal, id: 'goal-456' }];

      prisma.goal.findMany.mockResolvedValue(activeGoals as any);
      const analyzeGoalSpy = jest
        .spyOn(service, 'analyzeGoalRebalancing')
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce([]);

      await service.analyzeGoalsForRebalancing();

      expect(analyzeGoalSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle empty goal list gracefully', async () => {
      prisma.goal.findMany.mockResolvedValue([]);

      await expect(service.analyzeGoalsForRebalancing()).resolves.not.toThrow();
    });

    it('should handle errors during goal fetching', async () => {
      prisma.goal.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.analyzeGoalsForRebalancing()).resolves.not.toThrow();
    });
  });

  describe('executeRebalancingActions (private)', () => {
    it('should skip execution when no user found', async () => {
      const goalWithoutUser = { ...mockGoal, space: { userSpaces: [] } };

      await (service as any).executeRebalancingActions(goalWithoutUser, [
        {
          goalId: 'goal-123',
          goalName: 'Test',
          accountId: 'account-1',
          action: 'buy',
          amount: 1000,
          reason: 'Test',
        },
      ]);

      expect(transactionExecution.createOrder).not.toHaveBeenCalled();
    });

    it('should skip action when account not found', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await (service as any).executeRebalancingActions(mockGoal, [
        {
          goalId: 'goal-123',
          goalName: 'Test',
          accountId: 'nonexistent',
          action: 'buy',
          amount: 1000,
          reason: 'Test',
        },
      ]);

      expect(transactionExecution.createOrder).not.toHaveBeenCalled();
    });

    it('should handle order creation failures gracefully', async () => {
      prisma.account.findUnique.mockResolvedValue(mockGoal.allocations[0].account as any);
      transactionExecution.createOrder.mockRejectedValue(new Error('Order failed'));

      await expect(
        (service as any).executeRebalancingActions(mockGoal, [
          {
            goalId: 'goal-123',
            goalName: 'Test',
            accountId: 'account-1',
            action: 'buy',
            amount: 1000,
            reason: 'Test',
          },
        ])
      ).resolves.not.toThrow();
    });
  });
});
