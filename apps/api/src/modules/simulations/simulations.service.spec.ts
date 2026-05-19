import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../core/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';

import { ScenarioTypeDto } from './dto/analyze-scenario.dto';
import { SimulationsService } from './simulations.service';

// Mock Prisma SimulationType enum
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  SimulationType: {
    wealth_accumulation: 'wealth_accumulation',
    retirement: 'retirement',
    safe_withdrawal: 'safe_withdrawal',
    scenario_analysis: 'scenario_analysis',
  },
}));

// Mock the @dhanam/simulations package (virtual mock for planned package)
jest.mock(
  '@dhanam/simulations',
  () => ({
    monteCarloEngine: {
      simulate: jest.fn(),
      simulateRetirement: jest.fn(),
      calculateSafeWithdrawalRate: jest.fn(),
    },
    scenarioAnalysisEngine: {
      analyzeScenario: jest.fn(),
    },
    ScenarioType: {
      JOB_LOSS: 'job_loss',
      MARKET_CRASH: 'market_crash',
      RECESSION: 'recession',
      MEDICAL_EMERGENCY: 'medical_emergency',
      INFLATION_SPIKE: 'inflation_spike',
      DISABILITY: 'disability',
      MARKET_CORRECTION: 'market_correction',
    },
  }),
  { virtual: true }
);

describe('SimulationsService', () => {
  let service: SimulationsService;
  let prismaService: PrismaService;
  let billingService: BillingService;
  let monteCarloEngine: any;
  let scenarioAnalysisEngine: any;

  const mockPrismaService = {
    simulation: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ subscriptionTier: 'pro' }),
    },
  };

  const mockBillingService = {
    recordUsage: jest.fn(),
    getTierLimits: jest.fn().mockReturnValue({
      monteCarloMaxIterations: 10_000,
      monteCarloMaxScenarios: 12,
    }),
  };

  beforeAll(() => {
    // Import mocked module
    const simulationsMock = require('@dhanam/simulations');
    monteCarloEngine = simulationsMock.monteCarloEngine;
    scenarioAnalysisEngine = simulationsMock.scenarioAnalysisEngine;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SimulationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    // Suppress logger output
    module.useLogger(false);

    service = module.get<SimulationsService>(SimulationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    billingService = module.get<BillingService>(BillingService);

    jest.clearAllMocks();
  });

  describe('runSimulation', () => {
    const mockDto = {
      type: 'wealth_accumulation' as any,
      spaceId: 'space-123',
      goalId: 'goal-456',
      initialBalance: 10000,
      monthlyContribution: 500,
      years: 10,
      expectedReturn: 0.07,
      returnVolatility: 0.15,
      inflationRate: 0.02,
      inflationAdjustedContributions: true,
    };

    const mockSimulation = {
      id: 'sim-123',
      userId: 'user-123',
      spaceId: 'space-123',
      goalId: 'goal-456',
      type: 'wealth_accumulation',
      config: mockDto,
      status: 'running',
      createdAt: new Date(),
    };

    it('should create simulation record with running status', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockReturnValue({
        median: 85000,
        percentile10: 65000,
        percentile25: 72000,
        percentile75: 98000,
        percentile90: 112000,
        executionTimeMs: 1250,
      });
      mockPrismaService.simulation.update.mockResolvedValue({
        ...mockSimulation,
        status: 'completed',
      });

      await service.runSimulation('user-123', mockDto);

      expect(mockPrismaService.simulation.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          spaceId: 'space-123',
          goalId: 'goal-456',
          type: 'wealth_accumulation',
          config: mockDto,
          status: 'running',
        },
      });
    });

    it('should execute Monte Carlo simulation with correct config', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockReturnValue({
        median: 85000,
        executionTimeMs: 1250,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runSimulation('user-123', mockDto);

      expect(monteCarloEngine.simulate).toHaveBeenCalledWith({
        initialBalance: 10000,
        monthlyContribution: 500,
        years: 10,
        iterations: 10000, // Default value
        expectedReturn: 0.07,
        returnVolatility: 0.15,
        inflationRate: 0.02,
        inflationAdjustedContributions: true,
      });
    });

    it('should apply custom iterations if provided', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockReturnValue({
        median: 85000,
        executionTimeMs: 1250,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      const dtoWithIterations = { ...mockDto, iterations: 5000 };
      await service.runSimulation('user-123', dtoWithIterations);

      expect(monteCarloEngine.simulate).toHaveBeenCalledWith(
        expect.objectContaining({
          iterations: 5000,
        })
      );
    });

    it('should update simulation with result and completed status', async () => {
      const mockResult = {
        median: 85000,
        percentile10: 65000,
        percentile25: 72000,
        percentile75: 98000,
        percentile90: 112000,
        successProbability: 0.85,
        executionTimeMs: 1250,
      };

      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockReturnValue(mockResult);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runSimulation('user-123', mockDto);

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-123' },
        data: {
          result: mockResult,
          status: 'completed',
          executionTimeMs: 1250,
        },
      });
    });

    it('should record billing usage for completed simulation', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockReturnValue({
        median: 85000,
        executionTimeMs: 1250,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runSimulation('user-123', mockDto);

      expect(mockBillingService.recordUsage).toHaveBeenCalledWith(
        'user-123',
        'monte_carlo_simulation'
      );
    });

    it('should return simulation result with simulationId', async () => {
      const mockResult = {
        median: 85000,
        percentile10: 65000,
        executionTimeMs: 1250,
      };

      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockReturnValue(mockResult);
      mockPrismaService.simulation.update.mockResolvedValue({});

      const result = await service.runSimulation('user-123', mockDto);

      expect(result).toEqual({
        simulationId: 'sim-123',
        ...mockResult,
      });
    });

    it('should handle simulation failure and update status', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockImplementation(() => {
        throw new Error('Simulation engine error');
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await expect(service.runSimulation('user-123', mockDto)).rejects.toThrow(
        'Simulation engine error'
      );

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-123' },
        data: {
          status: 'failed',
          errorMessage: 'Simulation engine error',
        },
      });
    });

    it('should not record billing for failed simulation', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulate as jest.Mock).mockImplementation(() => {
        throw new Error('Simulation failed');
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await expect(service.runSimulation('user-123', mockDto)).rejects.toThrow();

      expect(mockBillingService.recordUsage).not.toHaveBeenCalled();
    });
  });

  describe('runRetirementSimulation', () => {
    const mockDto = {
      spaceId: 'space-123',
      goalId: 'goal-retirement',
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      currentSavings: 50000,
      monthlyContribution: 1000,
      monthlyWithdrawal: 4000,
      preRetirementReturn: 0.08,
      postRetirementReturn: 0.05,
      returnVolatility: 0.15,
      iterations: 10000,
      inflationRate: 0.025,
    };

    const mockSimulation = {
      id: 'sim-retirement-123',
      userId: 'user-123',
      type: 'retirement',
      status: 'running',
    };

    it('should create retirement simulation record', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulateRetirement as jest.Mock).mockReturnValue({
        successProbability: 0.92,
        medianEndingBalance: 850000,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runRetirementSimulation('user-123', mockDto);

      expect(mockPrismaService.simulation.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          spaceId: 'space-123',
          goalId: 'goal-retirement',
          type: 'retirement',
          config: mockDto,
          status: 'running',
        },
      });
    });

    it('should execute retirement simulation with correct config', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulateRetirement as jest.Mock).mockReturnValue({
        successProbability: 0.92,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runRetirementSimulation('user-123', mockDto);

      expect(monteCarloEngine.simulateRetirement).toHaveBeenCalledWith({
        currentAge: 35,
        retirementAge: 65,
        lifeExpectancy: 90,
        currentSavings: 50000,
        monthlyContribution: 1000,
        monthlyWithdrawal: 4000,
        preRetirementReturn: 0.08,
        postRetirementReturn: 0.05,
        returnVolatility: 0.15,
        iterations: 10000,
        inflationRate: 0.025,
      });
    });

    it('should update simulation with result and execution time', async () => {
      const mockResult = {
        successProbability: 0.92,
        medianEndingBalance: 850000,
        percentile10EndingBalance: 450000,
        percentile90EndingBalance: 1200000,
      };

      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulateRetirement as jest.Mock).mockReturnValue(mockResult);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runRetirementSimulation('user-123', mockDto);

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-retirement-123' },
        data: {
          result: mockResult,
          status: 'completed',
          executionTimeMs: expect.any(Number),
        },
      });
    });

    it('should record billing usage for retirement simulation', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulateRetirement as jest.Mock).mockReturnValue({
        successProbability: 0.92,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.runRetirementSimulation('user-123', mockDto);

      expect(mockBillingService.recordUsage).toHaveBeenCalledWith(
        'user-123',
        'monte_carlo_simulation'
      );
    });

    it('should handle retirement simulation failure', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.simulateRetirement as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid retirement parameters');
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await expect(service.runRetirementSimulation('user-123', mockDto)).rejects.toThrow(
        'Invalid retirement parameters'
      );

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-retirement-123' },
        data: {
          status: 'failed',
          errorMessage: 'Invalid retirement parameters',
        },
      });
    });
  });

  describe('calculateSafeWithdrawalRate', () => {
    const mockDto = {
      spaceId: 'space-123',
      portfolioValue: 1000000,
      yearsInRetirement: 30,
      successProbability: 0.95,
      expectedReturn: 0.07,
      returnVolatility: 0.15,
      inflationRate: 0.025,
    };

    const mockSimulation = {
      id: 'sim-swr-123',
      userId: 'user-123',
      type: 'safe_withdrawal',
      status: 'running',
    };

    it('should create safe withdrawal rate simulation record', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.calculateSafeWithdrawalRate as jest.Mock).mockReturnValue(0.04);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.calculateSafeWithdrawalRate('user-123', mockDto);

      expect(mockPrismaService.simulation.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          spaceId: 'space-123',
          type: 'safe_withdrawal',
          config: mockDto,
          status: 'running',
        },
      });
    });

    it('should calculate safe withdrawal rate with correct params', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.calculateSafeWithdrawalRate as jest.Mock).mockReturnValue(0.04);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.calculateSafeWithdrawalRate('user-123', mockDto);

      expect(monteCarloEngine.calculateSafeWithdrawalRate).toHaveBeenCalledWith({
        portfolioValue: 1000000,
        yearsInRetirement: 30,
        successProbability: 0.95,
        expectedReturn: 0.07,
        returnVolatility: 0.15,
        inflationRate: 0.025,
      });
    });

    it('should calculate annual and monthly withdrawal amounts', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.calculateSafeWithdrawalRate as jest.Mock).mockReturnValue(0.04); // 4% safe withdrawal rate
      mockPrismaService.simulation.update.mockResolvedValue({});

      const result = await service.calculateSafeWithdrawalRate('user-123', mockDto);

      expect(result.safeWithdrawalRate).toBe(0.04);
      expect(result.annualWithdrawalAmount).toBe(40000); // 1M * 0.04
      expect(result.monthlyWithdrawalAmount).toBeCloseTo(3333.33, 1); // 40000 / 12
      expect(result.portfolioValue).toBe(1000000);
      expect(result.successProbability).toBe(0.95);
    });

    it('should update simulation with calculated results', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.calculateSafeWithdrawalRate as jest.Mock).mockReturnValue(0.04);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.calculateSafeWithdrawalRate('user-123', mockDto);

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-swr-123' },
        data: {
          result: {
            safeWithdrawalRate: 0.04,
            annualWithdrawalAmount: 40000,
            monthlyWithdrawalAmount: expect.any(Number),
            successProbability: 0.95,
            portfolioValue: 1000000,
          },
          status: 'completed',
          executionTimeMs: expect.any(Number),
        },
      });
    });

    it('should record billing usage for safe withdrawal calculation', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.calculateSafeWithdrawalRate as jest.Mock).mockReturnValue(0.04);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.calculateSafeWithdrawalRate('user-123', mockDto);

      expect(mockBillingService.recordUsage).toHaveBeenCalledWith(
        'user-123',
        'monte_carlo_simulation'
      );
    });

    it('should handle calculation failure', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (monteCarloEngine.calculateSafeWithdrawalRate as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid parameters');
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await expect(service.calculateSafeWithdrawalRate('user-123', mockDto)).rejects.toThrow(
        'Invalid parameters'
      );

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-swr-123' },
        data: {
          status: 'failed',
          errorMessage: 'Invalid parameters',
        },
      });
    });
  });

  describe('analyzeScenario', () => {
    const mockDto = {
      scenarioType: ScenarioTypeDto.MARKET_CRASH,
      initialBalance: 50000,
      monthlyContribution: 1000,
      years: 20,
      expectedReturn: 0.08,
      returnVolatility: 0.18,
      inflationRate: 0.025,
    };

    const mockSimulation = {
      id: 'sim-scenario-123',
      userId: 'user-123',
      type: 'scenario_analysis',
      status: 'running',
    };

    it('should create scenario analysis simulation record', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockReturnValue({
        baseline: { median: 500000 },
        stressed: { median: 350000 },
        impact: -30,
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.analyzeScenario('user-123', mockDto);

      expect(mockPrismaService.simulation.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'scenario_analysis',
          config: mockDto,
          status: 'running',
        },
      });
    });

    it('should analyze market crash scenario', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockReturnValue({
        baseline: { median: 500000 },
        stressed: { median: 350000 },
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.analyzeScenario('user-123', mockDto);

      expect(scenarioAnalysisEngine.analyzeScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          initialBalance: 50000,
          monthlyContribution: 1000,
          years: 20,
          iterations: 10000,
          expectedReturn: 0.08,
          returnVolatility: 0.18,
          inflationRate: 0.025,
        }),
        'market_crash'
      );
    });

    it('should analyze job loss scenario', async () => {
      const jobLossDto = { ...mockDto, scenarioType: ScenarioTypeDto.JOB_LOSS };
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockReturnValue({
        baseline: { median: 500000 },
        stressed: { median: 400000 },
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.analyzeScenario('user-123', jobLossDto);

      expect(scenarioAnalysisEngine.analyzeScenario).toHaveBeenCalledWith(
        expect.any(Object),
        'job_loss'
      );
    });

    it('should analyze medical emergency scenario', async () => {
      const medicalDto = {
        ...mockDto,
        scenarioType: ScenarioTypeDto.MEDICAL_EMERGENCY,
      };
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockReturnValue({
        baseline: { median: 500000 },
        stressed: { median: 420000 },
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.analyzeScenario('user-123', medicalDto);

      expect(scenarioAnalysisEngine.analyzeScenario).toHaveBeenCalledWith(
        expect.any(Object),
        'medical_emergency'
      );
    });

    it('should update simulation with scenario analysis result', async () => {
      const mockResult = {
        baseline: { median: 500000, percentile10: 400000 },
        stressed: { median: 350000, percentile10: 250000 },
        impact: -30,
        recoveryYears: 8,
      };

      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockReturnValue(mockResult);
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.analyzeScenario('user-123', mockDto);

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-scenario-123' },
        data: {
          result: mockResult,
          status: 'completed',
          executionTimeMs: expect.any(Number),
        },
      });
    });

    it('should record double billing for scenario analysis', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockReturnValue({
        baseline: { median: 500000 },
        stressed: { median: 350000 },
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await service.analyzeScenario('user-123', mockDto);

      // Should be called twice (baseline + stressed scenario)
      expect(mockBillingService.recordUsage).toHaveBeenCalledTimes(2);
      expect(mockBillingService.recordUsage).toHaveBeenNthCalledWith(
        1,
        'user-123',
        'monte_carlo_simulation'
      );
      expect(mockBillingService.recordUsage).toHaveBeenNthCalledWith(
        2,
        'user-123',
        'monte_carlo_simulation'
      );
    });

    it('should handle scenario analysis failure', async () => {
      mockPrismaService.simulation.create.mockResolvedValue(mockSimulation);
      (scenarioAnalysisEngine.analyzeScenario as jest.Mock).mockImplementation(() => {
        throw new Error('Scenario analysis failed');
      });
      mockPrismaService.simulation.update.mockResolvedValue({});

      await expect(service.analyzeScenario('user-123', mockDto)).rejects.toThrow(
        'Scenario analysis failed'
      );

      expect(mockPrismaService.simulation.update).toHaveBeenCalledWith({
        where: { id: 'sim-scenario-123' },
        data: {
          status: 'failed',
          errorMessage: 'Scenario analysis failed',
        },
      });
    });
  });

  describe('getSimulation', () => {
    const mockSimulation = {
      id: 'sim-123',
      userId: 'user-123',
      spaceId: 'space-123',
      type: 'wealth_accumulation',
      status: 'completed',
      result: { median: 85000 },
      space: {
        id: 'space-123',
        name: 'Personal',
      },
      goal: {
        id: 'goal-456',
        name: 'Emergency Fund',
        type: 'savings',
      },
    };

    it('should return simulation by ID with space and goal details', async () => {
      mockPrismaService.simulation.findUnique.mockResolvedValue(mockSimulation);

      const result = await service.getSimulation('user-123', 'sim-123');

      expect(result).toEqual(mockSimulation);
      expect(mockPrismaService.simulation.findUnique).toHaveBeenCalledWith({
        where: { id: 'sim-123' },
        include: {
          space: {
            select: {
              id: true,
              name: true,
            },
          },
          goal: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if simulation not found', async () => {
      mockPrismaService.simulation.findUnique.mockResolvedValue(null);

      await expect(service.getSimulation('user-123', 'sim-nonexistent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException if user does not own simulation', async () => {
      const otherUserSimulation = { ...mockSimulation, userId: 'user-456' };
      mockPrismaService.simulation.findUnique.mockResolvedValue(otherUserSimulation);

      await expect(service.getSimulation('user-123', 'sim-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listSimulations', () => {
    const mockSimulations = [
      {
        id: 'sim-1',
        userId: 'user-123',
        spaceId: 'space-123',
        type: 'wealth_accumulation',
        status: 'completed',
        createdAt: new Date('2024-01-15'),
        space: { id: 'space-123', name: 'Personal' },
        goal: { id: 'goal-1', name: 'Emergency Fund', type: 'savings' },
      },
      {
        id: 'sim-2',
        userId: 'user-123',
        spaceId: 'space-456',
        type: 'retirement',
        status: 'completed',
        createdAt: new Date('2024-01-10'),
        space: { id: 'space-456', name: 'Business' },
        goal: null,
      },
    ];

    it('should list all simulations for user', async () => {
      mockPrismaService.simulation.findMany.mockResolvedValue(mockSimulations);

      const result = await service.listSimulations('user-123');

      expect(result).toEqual(mockSimulations);
      expect(mockPrismaService.simulation.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          space: {
            select: { id: true, name: true },
          },
          goal: {
            select: { id: true, name: true, type: true },
          },
        },
      });
    });

    it('should filter simulations by spaceId', async () => {
      mockPrismaService.simulation.findMany.mockResolvedValue([mockSimulations[0]]);

      await service.listSimulations('user-123', { spaceId: 'space-123' });

      expect(mockPrismaService.simulation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', spaceId: 'space-123' },
        })
      );
    });

    it('should filter simulations by goalId', async () => {
      mockPrismaService.simulation.findMany.mockResolvedValue([mockSimulations[0]]);

      await service.listSimulations('user-123', { goalId: 'goal-1' });

      expect(mockPrismaService.simulation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', goalId: 'goal-1' },
        })
      );
    });

    it('should filter simulations by type', async () => {
      mockPrismaService.simulation.findMany.mockResolvedValue([mockSimulations[1]]);

      await service.listSimulations('user-123', { type: 'retirement' });

      expect(mockPrismaService.simulation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', type: 'retirement' },
        })
      );
    });

    it('should apply custom limit', async () => {
      mockPrismaService.simulation.findMany.mockResolvedValue(mockSimulations);

      await service.listSimulations('user-123', { limit: 10 });

      expect(mockPrismaService.simulation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('should order by createdAt descending', async () => {
      mockPrismaService.simulation.findMany.mockResolvedValue(mockSimulations);

      await service.listSimulations('user-123');

      expect(mockPrismaService.simulation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('deleteSimulation', () => {
    const mockSimulation = {
      id: 'sim-123',
      userId: 'user-123',
      type: 'wealth_accumulation',
      status: 'completed',
    };

    it('should delete simulation after verifying ownership', async () => {
      mockPrismaService.simulation.findUnique.mockResolvedValue(mockSimulation);
      mockPrismaService.simulation.delete.mockResolvedValue(mockSimulation);

      const result = await service.deleteSimulation('user-123', 'sim-123');

      expect(result).toEqual({ deleted: true });
      expect(mockPrismaService.simulation.delete).toHaveBeenCalledWith({
        where: { id: 'sim-123' },
      });
    });

    it('should throw NotFoundException if simulation not found', async () => {
      mockPrismaService.simulation.findUnique.mockResolvedValue(null);

      await expect(service.deleteSimulation('user-123', 'sim-nonexistent')).rejects.toThrow(
        NotFoundException
      );

      expect(mockPrismaService.simulation.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not own simulation', async () => {
      const otherUserSimulation = { ...mockSimulation, userId: 'user-456' };
      mockPrismaService.simulation.findUnique.mockResolvedValue(otherUserSimulation);

      await expect(service.deleteSimulation('user-123', 'sim-123')).rejects.toThrow(
        NotFoundException
      );

      expect(mockPrismaService.simulation.delete).not.toHaveBeenCalled();
    });
  });
});
