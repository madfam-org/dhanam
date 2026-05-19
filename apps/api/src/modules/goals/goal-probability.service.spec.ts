import { Test, TestingModule } from '@nestjs/testing';

import { Decimal } from '@db';

import { MonteCarloEngine } from '../simulations/engines/monte-carlo.engine';

import { GoalProbabilityService } from './goal-probability.service';

import { PrismaService } from '@/core/prisma/prisma.service';

describe('GoalProbabilityService', () => {
  let service: GoalProbabilityService;
  let prismaService: PrismaService;
  let monteCarloEngine: MonteCarloEngine;

  const mockPrismaService = {
    goal: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockMonteCarloEngine = {
    simulate: jest.fn(),
    calculateSuccessRate: jest.fn(),
    findRequiredContribution: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalProbabilityService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MonteCarloEngine, useValue: mockMonteCarloEngine },
      ],
    }).compile();

    // Suppress logger output
    module.useLogger(false);

    service = module.get<GoalProbabilityService>(GoalProbabilityService);
    prismaService = module.get<PrismaService>(PrismaService);
    monteCarloEngine = module.get<MonteCarloEngine>(MonteCarloEngine);

    jest.clearAllMocks();
  });

  describe('calculateGoalProbability', () => {
    const mockGoal = {
      id: 'goal-123',
      spaceId: 'space-123',
      targetAmount: new Decimal(50000),
      targetDate: new Date('2026-12-31'),
      monthlyContribution: new Decimal(500),
      expectedReturn: new Decimal(0.08),
      volatility: new Decimal(0.15),
      space: {
        id: 'space-123',
        name: 'Personal',
      },
      allocations: [
        {
          account: { balance: new Decimal(10000) },
          percentage: new Decimal(100), // 100% of account allocated to goal
        },
      ],
    };

    const mockSimulationResult = {
      finalValues: Array(10000).fill(55000), // Array of final balances
      p10: 45000,
      p50: 55000,
      p90: 65000,
      timeSeries: [
        { month: 0, median: 10000, p10: 10000, p90: 10000 },
        { month: 6, median: 13500, p10: 12000, p90: 15000 },
        { month: 12, median: 17200, p10: 15000, p90: 19500 },
        { month: 18, median: 25000, p10: 22000, p90: 28000 },
        { month: 24, median: 52000, p10: 45000, p90: 60000 }, // Crosses target
      ],
    };

    it('should calculate probability for goal with allocations', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82); // 82% success

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      expect(result.goalId).toBe('goal-123');
      expect(result.probability).toBe(82);
      expect(result.confidenceLow).toBe(45000);
      expect(result.confidenceHigh).toBe(65000);
      expect(result.currentProgress).toBeCloseTo(20, 0); // 10000/50000 = 20%
      expect(result.timeline).toHaveLength(5);
    });

    it('should calculate current balance from multiple allocations', async () => {
      const goalWithMultipleAllocations = {
        ...mockGoal,
        allocations: [
          {
            account: { balance: new Decimal(10000) },
            percentage: new Decimal(50), // 50% allocation
          },
          {
            account: { balance: new Decimal(20000) },
            percentage: new Decimal(25), // 25% allocation
          },
        ],
      };

      mockPrismaService.goal.findFirst.mockResolvedValue(goalWithMultipleAllocations);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.75);

      await service.calculateGoalProbability('user-123', 'goal-123');

      // Current balance = (10000 * 0.5) + (20000 * 0.25) = 5000 + 5000 = 10000
      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBalance: 10000,
        })
      );
    });

    it('should use default values for expected return and volatility if not set', async () => {
      const goalWithoutDefaults = {
        ...mockGoal,
        expectedReturn: null,
        volatility: null,
      };

      mockPrismaService.goal.findFirst.mockResolvedValue(goalWithoutDefaults);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.75);

      await service.calculateGoalProbability('user-123', 'goal-123');

      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedReturn: 0.07, // Default 7%
          volatility: 0.15, // Default 15%
        })
      );
    });

    it('should find projected completion date when median crosses target', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82);

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      // Should project completion at month 24 (when median first crosses 50000)
      expect(result.projectedCompletion).not.toBeNull();
      expect(result.projectedCompletion).toBeInstanceOf(Date);
    });

    it('should calculate recommended contribution when probability < 50%', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.35); // Only 35% success
      mockMonteCarloEngine.findRequiredContribution.mockReturnValue(800); // Recommend $800/month

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      expect(result.probability).toBe(35);
      expect(result.recommendedMonthlyContribution).toBe(800);
      expect(mockMonteCarloEngine.findRequiredContribution).toHaveBeenCalledWith(
        expect.any(Object),
        50000,
        0.75 // Target 75% success rate
      );
    });

    it('should keep current contribution when probability >= 50%', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82); // 82% success

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      expect(result.recommendedMonthlyContribution).toBe(500); // Keep current
      expect(mockMonteCarloEngine.findRequiredContribution).not.toHaveBeenCalled();
    });

    it('should handle goals past due date with current balance >= target (100% probability)', async () => {
      const pastDueGoal = {
        ...mockGoal,
        targetDate: new Date('2020-01-01'), // Past due
        allocations: [
          {
            account: { balance: new Decimal(60000) }, // More than target
            percentage: new Decimal(100),
          },
        ],
      };

      mockPrismaService.goal.findFirst.mockResolvedValue(pastDueGoal);

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      expect(result.probability).toBe(100);
      expect(result.confidenceLow).toBe(60000);
      expect(result.confidenceHigh).toBe(60000);
      expect(result.currentProgress).toBe(100); // Capped at 100%
      expect(result.projectedCompletion).toBeNull();
      expect(result.timeline).toEqual([]);
      expect(mockMonteCarloEngine.simulate).not.toHaveBeenCalled();
    });

    it('should handle goals past due date with current balance < target (0% probability)', async () => {
      const pastDueGoal = {
        ...mockGoal,
        targetDate: new Date('2020-01-01'), // Past due
        allocations: [
          {
            account: { balance: new Decimal(30000) }, // Less than target
            percentage: new Decimal(100),
          },
        ],
      };

      mockPrismaService.goal.findFirst.mockResolvedValue(pastDueGoal);

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      expect(result.probability).toBe(0);
      expect(result.currentProgress).toBe(60); // 30000/50000
      expect(result.projectedCompletion).toBeNull();
      expect(mockMonteCarloEngine.simulate).not.toHaveBeenCalled();
    });

    it('should throw error if goal not found', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(null);

      await expect(service.calculateGoalProbability('user-123', 'nonexistent')).rejects.toThrow(
        'Goal not found'
      );
    });

    it('should handle goal without monthly contribution', async () => {
      const goalWithoutContribution = {
        ...mockGoal,
        monthlyContribution: null,
      };

      mockPrismaService.goal.findFirst.mockResolvedValue(goalWithoutContribution);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.5);

      await service.calculateGoalProbability('user-123', 'goal-123');

      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyContribution: 0,
        })
      );
    });

    it('should handle findRequiredContribution failure gracefully', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.35); // Low probability
      mockMonteCarloEngine.findRequiredContribution.mockImplementation(() => {
        throw new Error('Cannot find required contribution');
      });

      const result = await service.calculateGoalProbability('user-123', 'goal-123');

      // Should fallback to current contribution when calculation fails
      expect(result.recommendedMonthlyContribution).toBe(500);
    });
  });

  describe('updateGoalProbability', () => {
    const mockGoal = {
      id: 'goal-123',
      spaceId: 'space-123',
      targetAmount: new Decimal(50000),
      targetDate: new Date('2026-12-31'),
      monthlyContribution: new Decimal(500),
      expectedReturn: new Decimal(0.08),
      volatility: new Decimal(0.15),
      allocations: [
        {
          account: { balance: new Decimal(10000) },
          percentage: new Decimal(100),
        },
      ],
    };

    const mockSimulationResult = {
      finalValues: Array(10000).fill(55000),
      p10: 45000,
      p90: 65000,
      timeSeries: [{ month: 24, median: 52000, p10: 45000, p90: 60000 }],
    };

    it('should update goal with probability data', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goal.findUnique.mockResolvedValue({
        probabilityHistory: [],
      });
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82);
      mockPrismaService.goal.update.mockResolvedValue({});

      await service.updateGoalProbability('user-123', 'goal-123');

      expect(mockPrismaService.goal.update).toHaveBeenCalledWith({
        where: { id: 'goal-123' },
        data: expect.objectContaining({
          currentProbability: 82,
          confidenceLow: 45000,
          confidenceHigh: 65000,
          currentProgress: 20,
          lastSimulationAt: expect.any(Date),
        }),
      });
    });

    it('should maintain probability history', async () => {
      const now = new Date();
      const existingHistory = [
        { date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), probability: 75 }, // 10 days ago
        { date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), probability: 78 }, // 5 days ago
      ];

      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goal.findUnique.mockResolvedValue({
        probabilityHistory: existingHistory,
      });
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82);
      mockPrismaService.goal.update.mockResolvedValue({});

      await service.updateGoalProbability('user-123', 'goal-123');

      const updateCall = mockPrismaService.goal.update.mock.calls[0][0];
      const probabilityHistory = updateCall.data.probabilityHistory;

      expect(probabilityHistory).toHaveLength(3); // 2 existing + 1 new
      expect(probabilityHistory[2].probability).toBe(82);
    });

    it('should keep only last 90 days of probability history', async () => {
      const now = new Date();
      const existingHistory = [
        {
          date: new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString(),
          probability: 70,
        }, // 100 days old
        { date: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString(), probability: 75 }, // 50 days old
        { date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(), probability: 78 }, // 10 days old
      ];

      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goal.findUnique.mockResolvedValue({
        probabilityHistory: existingHistory,
      });
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82);
      mockPrismaService.goal.update.mockResolvedValue({});

      await service.updateGoalProbability('user-123', 'goal-123');

      const updateCall = mockPrismaService.goal.update.mock.calls[0][0];
      const probabilityHistory = updateCall.data.probabilityHistory;

      // Should only keep entries from last 90 days (50-day and 10-day old) plus new entry
      expect(probabilityHistory.length).toBeLessThanOrEqual(3);
      // 100-day old entry should be filtered out
      expect(probabilityHistory[0].probability).not.toBe(70);
    });

    it('should handle goal without existing history', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockPrismaService.goal.findUnique.mockResolvedValue({
        probabilityHistory: null,
      });
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82);
      mockPrismaService.goal.update.mockResolvedValue({});

      await service.updateGoalProbability('user-123', 'goal-123');

      const updateCall = mockPrismaService.goal.update.mock.calls[0][0];
      const probabilityHistory = updateCall.data.probabilityHistory;

      expect(probabilityHistory).toHaveLength(1);
      expect(probabilityHistory[0].probability).toBe(82);
    });
  });

  describe('runWhatIfScenario', () => {
    const mockGoal = {
      id: 'goal-123',
      spaceId: 'space-123',
      targetAmount: new Decimal(50000),
      targetDate: new Date('2026-12-31'),
      monthlyContribution: new Decimal(500),
      expectedReturn: new Decimal(0.08),
      volatility: new Decimal(0.15),
      allocations: [
        {
          account: { balance: new Decimal(10000) },
          percentage: new Decimal(100),
        },
      ],
    };

    const mockSimulationResult = {
      finalValues: Array(10000).fill(55000),
      p10: 45000,
      p90: 65000,
      timeSeries: [{ month: 24, median: 52000, p10: 45000, p90: 60000 }],
    };

    it('should run scenario with modified monthly contribution', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.92);

      const result = await service.runWhatIfScenario('user-123', 'goal-123', {
        monthlyContribution: 1000, // Double the contribution
      });

      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyContribution: 1000,
        })
      );
      expect(result.probability).toBe(92);
      expect(result.recommendedMonthlyContribution).toBe(1000);
    });

    it('should run scenario with modified target amount', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.95);

      await service.runWhatIfScenario('user-123', 'goal-123', {
        targetAmount: 40000, // Lower target
      });

      expect(mockMonteCarloEngine.calculateSuccessRate).toHaveBeenCalledWith(
        expect.anything(),
        40000 // Should use new target
      );
    });

    it('should run scenario with modified target date', async () => {
      const newTargetDate = new Date('2028-12-31'); // 2 years later

      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.95);

      await service.runWhatIfScenario('user-123', 'goal-123', {
        targetDate: newTargetDate,
      });

      // Should calculate months until new target date
      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          months: expect.any(Number),
        })
      );
    });

    it('should run scenario with modified expected return', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.88);

      await service.runWhatIfScenario('user-123', 'goal-123', {
        expectedReturn: 0.1, // 10% instead of 8%
      });

      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedReturn: 0.1,
        })
      );
    });

    it('should run scenario with modified volatility', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.75);

      await service.runWhatIfScenario('user-123', 'goal-123', {
        volatility: 0.25, // Higher volatility
      });

      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          volatility: 0.25,
        })
      );
    });

    it('should run scenario with multiple modified parameters', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.98);

      await service.runWhatIfScenario('user-123', 'goal-123', {
        monthlyContribution: 800,
        targetAmount: 45000,
        expectedReturn: 0.09,
      });

      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyContribution: 800,
          expectedReturn: 0.09,
        })
      );
      expect(mockMonteCarloEngine.calculateSuccessRate).toHaveBeenCalledWith(
        expect.anything(),
        45000
      );
    });

    it('should throw error if target date is in the past', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);

      await expect(
        service.runWhatIfScenario('user-123', 'goal-123', {
          targetDate: new Date('2020-01-01'),
        })
      ).rejects.toThrow('Target date must be in the future');

      expect(mockMonteCarloEngine.simulate).not.toHaveBeenCalled();
    });

    it('should throw error if goal not found', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(null);

      await expect(
        service.runWhatIfScenario('user-123', 'nonexistent', {
          monthlyContribution: 1000,
        })
      ).rejects.toThrow('Goal not found');
    });

    it('should use original goal values when scenario does not override them', async () => {
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoal);
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.85);

      await service.runWhatIfScenario('user-123', 'goal-123', {
        monthlyContribution: 800, // Only override contribution
      });

      // Should use original values for expectedReturn and volatility
      expect(mockMonteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          expectedReturn: 0.08, // Original
          volatility: 0.15, // Original
        })
      );
    });
  });

  describe('updateAllGoalProbabilities', () => {
    const mockGoals = [
      {
        id: 'goal-1',
        spaceId: 'space-123',
        status: 'active',
        targetAmount: new Decimal(50000),
        targetDate: new Date('2026-12-31'),
        allocations: [
          {
            account: { balance: new Decimal(10000) },
            percentage: new Decimal(100),
          },
        ],
      },
      {
        id: 'goal-2',
        spaceId: 'space-123',
        status: 'active',
        targetAmount: new Decimal(30000),
        targetDate: new Date('2025-12-31'),
        allocations: [
          {
            account: { balance: new Decimal(15000) },
            percentage: new Decimal(100),
          },
        ],
      },
    ];

    const mockSimulationResult = {
      finalValues: Array(10000).fill(55000),
      p10: 45000,
      p90: 65000,
      timeSeries: [{ month: 24, median: 52000, p10: 45000, p90: 60000 }],
    };

    it('should update all active goals in space', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);
      mockPrismaService.goal.findFirst.mockResolvedValue(mockGoals[0]);
      mockPrismaService.goal.findUnique.mockResolvedValue({
        probabilityHistory: [],
      });
      mockMonteCarloEngine.simulate.mockReturnValue(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValue(0.82);
      mockPrismaService.goal.update.mockResolvedValue({});

      await service.updateAllGoalProbabilities('user-123', 'space-123');

      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-123',
          status: 'active',
          space: {
            userSpaces: {
              some: { userId: 'user-123' },
            },
          },
        },
        select: { id: true },
      });
    });

    it('should handle individual goal update failures gracefully', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      // First goal succeeds
      mockPrismaService.goal.findFirst.mockResolvedValueOnce(mockGoals[0]);
      mockPrismaService.goal.findUnique.mockResolvedValueOnce({ probabilityHistory: [] });
      mockMonteCarloEngine.simulate.mockReturnValueOnce(mockSimulationResult);
      mockMonteCarloEngine.calculateSuccessRate.mockReturnValueOnce(0.82);
      mockPrismaService.goal.update.mockResolvedValueOnce({});

      // Second goal fails
      mockPrismaService.goal.findFirst.mockResolvedValueOnce(null); // Simulate not found error

      // Should not throw, but continue processing
      await expect(
        service.updateAllGoalProbabilities('user-123', 'space-123')
      ).resolves.not.toThrow();
    });

    it('should only select active goals', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      await service.updateAllGoalProbabilities('user-123', 'space-123');

      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        })
      );
    });

    it('should verify user access to space', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue(mockGoals);

      await service.updateAllGoalProbabilities('user-123', 'space-123');

      expect(mockPrismaService.goal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            space: {
              userSpaces: {
                some: { userId: 'user-123' },
              },
            },
          }),
        })
      );
    });

    it('should handle empty goal list', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue([]);

      await expect(
        service.updateAllGoalProbabilities('user-123', 'space-123')
      ).resolves.not.toThrow();

      expect(mockPrismaService.goal.update).not.toHaveBeenCalled();
    });
  });
});
