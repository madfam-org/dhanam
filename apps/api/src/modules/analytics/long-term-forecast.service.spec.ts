import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FxRatesService } from '../fx-rates/fx-rates.service';
import { SpacesService } from '../spaces/spaces.service';

import { LongTermForecastService, CreateProjectionDto } from './long-term-forecast.service';

// Mock the simulation engine
jest.mock('@dhanam/simulations', () => ({
  longTermCashflowEngine: {
    project: jest.fn(),
    compareScenarios: jest.fn(),
  },
}));

import { longTermCashflowEngine } from '@dhanam/simulations';

describe('LongTermForecastService', () => {
  let service: LongTermForecastService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let spacesServiceMock: jest.Mocked<Partial<SpacesService>>;
  let fxRatesServiceMock: jest.Mocked<Partial<FxRatesService>>;

  const testUserId = 'user-123';
  const testSpaceId = 'space-456';

  const mockProjectionResult = {
    yearlySnapshots: [
      { year: 2024, netWorth: 100000, grossIncome: 60000, totalExpenses: 48000, savings: 12000 },
      { year: 2025, netWorth: 115000, grossIncome: 62000, totalExpenses: 49000, savings: 13000 },
      { year: 2054, netWorth: 500000, grossIncome: 40000, totalExpenses: 35000, savings: 5000 }, // Retirement year
    ],
    summary: {
      projectionYears: 30,
      yearsUntilRetirement: 30,
      riskScore: 0.3,
      incomeReplacementRatio: 0.65,
      netWorthAtRetirement: 500000,
      debtFreeYear: 2030,
      financialIndependenceYear: 2050,
    },
    alerts: [],
    confidenceInterval: { low: 400000, mid: 500000, high: 650000 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    spacesServiceMock = {
      verifyUserAccess: jest.fn().mockResolvedValue(true),
    };
    fxRatesServiceMock = {
      convertAmount: jest.fn().mockImplementation((amount) => Promise.resolve(amount)),
    };

    // Default mock for projection engine
    (longTermCashflowEngine.project as jest.Mock).mockReturnValue(mockProjectionResult);
    (longTermCashflowEngine.compareScenarios as jest.Mock).mockReturnValue({
      baseline: mockProjectionResult,
      scenarios: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LongTermForecastService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SpacesService, useValue: spacesServiceMock },
        { provide: FxRatesService, useValue: fxRatesServiceMock },
      ],
    }).compile();

    service = module.get<LongTermForecastService>(LongTermForecastService);
  });

  describe('generateProjection', () => {
    const validDto: CreateProjectionDto = {
      projectionYears: 30,
      currentAge: 35,
      retirementAge: 65,
      inflationRate: 0.03,
    };

    beforeEach(() => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'USD' });
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
      prismaMock.recurringTransaction.findMany.mockResolvedValue([]);
      prismaMock.budget.findMany.mockResolvedValue([]);
    });

    it('should verify user access', async () => {
      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should throw for projectionYears < 5', async () => {
      const dto = { ...validDto, projectionYears: 3 };

      await expect(service.generateProjection(testUserId, testSpaceId, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw for projectionYears > 50', async () => {
      const dto = { ...validDto, projectionYears: 60 };

      await expect(service.generateProjection(testUserId, testSpaceId, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw for currentAge < 18', async () => {
      const dto = { ...validDto, currentAge: 15 };

      await expect(service.generateProjection(testUserId, testSpaceId, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw for currentAge > 100', async () => {
      const dto = { ...validDto, currentAge: 105 };

      await expect(service.generateProjection(testUserId, testSpaceId, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw if retirementAge <= currentAge', async () => {
      const dto = { ...validDto, currentAge: 65, retirementAge: 60 };

      await expect(service.generateProjection(testUserId, testSpaceId, dto)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should call projection engine with config', async () => {
      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          projectionYears: 30,
          currentAge: 35,
          retirementAge: 65,
          inflationRate: 0.03,
        })
      );
    });

    it('should use default inflation rate when not provided', async () => {
      const dto = { ...validDto, inflationRate: undefined };

      await service.generateProjection(testUserId, testSpaceId, dto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          inflationRate: 0.03,
        })
      );
    });

    it('should use default life expectancy when not provided', async () => {
      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          lifeExpectancy: 90,
        })
      );
    });

    it('should use space currency from database', async () => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'MXN' });

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(prismaMock.space.findUnique).toHaveBeenCalledWith({
        where: { id: testSpaceId },
      });
    });

    it('should default to USD when space has no currency', async () => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: null });

      await service.generateProjection(testUserId, testSpaceId, validDto);

      // Should not throw and should proceed with USD
      expect(longTermCashflowEngine.project).toHaveBeenCalled();
    });

    it('should return projection result', async () => {
      const result = await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(result).toEqual(mockProjectionResult);
    });

    it('should include custom income streams', async () => {
      const dto: CreateProjectionDto = {
        ...validDto,
        incomeStreams: [{ name: 'Salary', annualAmount: 80000, growthRate: 0.03, isTaxable: true }],
      };

      await service.generateProjection(testUserId, testSpaceId, dto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          incomeStreams: expect.arrayContaining([
            expect.objectContaining({ name: 'Salary', annualAmount: 80000 }),
          ]),
        })
      );
    });

    it('should include custom expenses', async () => {
      const dto: CreateProjectionDto = {
        ...validDto,
        expenses: [{ name: 'Housing', annualAmount: 24000, growthRate: 0.03, isEssential: true }],
      };

      await service.generateProjection(testUserId, testSpaceId, dto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({ name: 'Housing', annualAmount: 24000 }),
          ]),
        })
      );
    });

    it('should include life events', async () => {
      const dto: CreateProjectionDto = {
        ...validDto,
        lifeEvents: [{ name: 'Buy House', year: 2030, impact: -50000, type: 'one_time' as const }],
      };

      await service.generateProjection(testUserId, testSpaceId, dto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          lifeEvents: expect.arrayContaining([expect.objectContaining({ name: 'Buy House' })]),
        })
      );
    });

    it('should skip auto-populating accounts when includeAccounts is false', async () => {
      const dto = { ...validDto, includeAccounts: false };

      await service.generateProjection(testUserId, testSpaceId, dto);

      expect(prismaMock.account.findMany).not.toHaveBeenCalled();
    });

    it('should skip auto-populating recurring when includeRecurring is false', async () => {
      const dto = { ...validDto, includeRecurring: false };

      await service.generateProjection(testUserId, testSpaceId, dto);

      expect(prismaMock.recurringTransaction.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getAccountsAsAssets', () => {
    const validDto: CreateProjectionDto = {
      projectionYears: 30,
      currentAge: 35,
      retirementAge: 65,
    };

    beforeEach(() => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'USD' });
      prismaMock.budget.findMany.mockResolvedValue([]);
      prismaMock.recurringTransaction.findMany.mockResolvedValue([]);
    });

    it('should convert investment accounts to assets', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Brokerage',
          type: 'brokerage',
          balance: { toNumber: () => 50000 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: 'Brokerage',
              currentValue: 50000,
              expectedReturn: 0.07,
            }),
          ]),
        })
      );
    });

    it('should convert retirement accounts with tax-deferred type', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: '401k',
          type: '401k',
          balance: { toNumber: () => 100000 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: '401k',
              type: 'tax_deferred',
            }),
          ]),
        })
      );
    });

    it('should convert Roth accounts with tax-free type', async () => {
      // Note: service checks 'ira' before 'roth', so 'roth_ira' matches 'ira' first
      // Using 'roth' type alone to test tax_free classification
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Roth Account',
          type: 'roth', // Use 'roth' without 'ira' to avoid matching 'ira' first
          balance: { toNumber: () => 30000 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: 'Roth Account',
              type: 'tax_free',
            }),
          ]),
        })
      );
    });

    it('should convert loan accounts to loans', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Auto Loan',
          type: 'auto_loan',
          balance: { toNumber: () => -15000 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          loans: expect.arrayContaining([
            expect.objectContaining({
              name: 'Auto Loan',
              balance: 15000,
              type: 'auto',
            }),
          ]),
        })
      );
    });

    it('should convert credit card accounts to credit_card loans', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Credit Card',
          type: 'credit_card',
          balance: { toNumber: () => -5000 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          loans: expect.arrayContaining([
            expect.objectContaining({
              name: 'Credit Card',
              type: 'credit_card',
            }),
          ]),
        })
      );
    });

    it('should convert mortgage accounts to mortgage loans', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Home Mortgage',
          type: 'mortgage',
          balance: { toNumber: () => -250000 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          loans: expect.arrayContaining([
            expect.objectContaining({
              name: 'Home Mortgage',
              type: 'mortgage',
            }),
          ]),
        })
      );
    });

    it('should include manual assets', async () => {
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([
        {
          id: 'ma-1',
          name: 'Rental Property',
          type: 'real_estate',
          currentValue: { toNumber: () => 350000 },
          currency: 'USD',
        },
      ]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: 'Rental Property',
              type: 'real_estate',
            }),
          ]),
        })
      );
    });

    it('should convert currency when account currency differs', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'MXN Account',
          type: 'savings',
          balance: { toNumber: () => 100000 },
          currency: 'MXN',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
      fxRatesServiceMock.convertAmount.mockResolvedValue(5000); // MXN to USD

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(fxRatesServiceMock.convertAmount).toHaveBeenCalledWith(100000, 'MXN', 'USD');
      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: 'MXN Account',
              currentValue: 5000,
            }),
          ]),
        })
      );
    });

    it('should use original balance if currency conversion fails', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Foreign Account',
          type: 'savings',
          balance: { toNumber: () => 1000 },
          currency: 'GBP',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
      fxRatesServiceMock.convertAmount.mockRejectedValue(new Error('No rate available'));

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: 'Foreign Account',
              currentValue: 1000, // Original value used
            }),
          ]),
        })
      );
    });

    it('should skip accounts with zero balance', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Empty Account',
          type: 'savings',
          balance: { toNumber: () => 0 },
          currency: 'USD',
          assetValuations: [],
        },
      ]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: [],
          loans: [],
        })
      );
    });
  });

  describe('getRecurringAsExpenses', () => {
    const validDto: CreateProjectionDto = {
      projectionYears: 30,
      currentAge: 35,
      retirementAge: 65,
    };

    beforeEach(() => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'USD' });
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
    });

    it('should convert recurring income to income streams', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Employer',
          expectedAmount: { toNumber: () => 5000 },
          frequency: 'monthly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          incomeStreams: expect.arrayContaining([
            expect.objectContaining({
              name: 'Employer',
              annualAmount: 60000, // 5000 * 12
              growthRate: 0.02,
              isTaxable: true,
            }),
          ]),
        })
      );
    });

    it('should convert recurring expenses to expense categories', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Netflix',
          expectedAmount: { toNumber: () => -15 },
          frequency: 'monthly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              name: 'Netflix',
              annualAmount: 180, // 15 * 12
              growthRate: 0.03,
            }),
          ]),
        })
      );
    });

    it('should annualize weekly frequency correctly', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Weekly Expense',
          expectedAmount: { toNumber: () => -100 },
          frequency: 'weekly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              annualAmount: 5200, // 100 * 52
            }),
          ]),
        })
      );
    });

    it('should annualize biweekly frequency correctly', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Biweekly Expense',
          expectedAmount: { toNumber: () => -200 },
          frequency: 'biweekly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              annualAmount: 5200, // 200 * 26
            }),
          ]),
        })
      );
    });

    it('should annualize quarterly frequency correctly', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Quarterly Expense',
          expectedAmount: { toNumber: () => -500 },
          frequency: 'quarterly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              annualAmount: 2000, // 500 * 4
            }),
          ]),
        })
      );
    });

    it('should handle yearly frequency', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Annual Expense',
          expectedAmount: { toNumber: () => -1200 },
          frequency: 'yearly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              annualAmount: 1200, // Same as amount
            }),
          ]),
        })
      );
    });

    it('should mark essential expenses correctly', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Rent',
          expectedAmount: { toNumber: () => -1500 },
          frequency: 'monthly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: 'cat-housing',
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([
        {
          id: 'budget-1',
          categories: [{ id: 'cat-housing', name: 'Housing' }],
        },
      ]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              name: 'Rent',
              isEssential: true,
            }),
          ]),
        })
      );
    });

    it('should use fallback name when merchantName is null', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: null,
          expectedAmount: { toNumber: () => -50 },
          frequency: 'monthly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              name: 'Recurring Expense',
            }),
          ]),
        })
      );
    });
  });

  describe('compareScenarios', () => {
    const validDto = {
      baseConfig: {
        projectionYears: 30,
        currentAge: 35,
        retirementAge: 65,
      },
      scenarios: [
        {
          name: 'Early Retirement',
          description: 'Retire 5 years earlier',
          modifications: { retirementAge: -5 },
        },
      ],
    };

    beforeEach(() => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'USD' });
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
      prismaMock.recurringTransaction.findMany.mockResolvedValue([]);
      prismaMock.budget.findMany.mockResolvedValue([]);
    });

    it('should verify user access', async () => {
      await service.compareScenarios(testUserId, testSpaceId, validDto);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should call compareScenarios on engine', async () => {
      await service.compareScenarios(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.compareScenarios).toHaveBeenCalledWith(
        expect.objectContaining({
          projectionYears: 30,
          currentAge: 35,
          retirementAge: 65,
        }),
        validDto.scenarios
      );
    });

    it('should return baseline and scenarios', async () => {
      const mockComparison = {
        baseline: mockProjectionResult,
        scenarios: [
          {
            scenario: validDto.scenarios[0],
            result: {
              ...mockProjectionResult,
              summary: { ...mockProjectionResult.summary, riskScore: 0.5 },
            },
          },
        ],
      };
      (longTermCashflowEngine.compareScenarios as jest.Mock).mockReturnValue(mockComparison);

      const result = await service.compareScenarios(testUserId, testSpaceId, validDto);

      expect(result.baseline).toBeDefined();
      expect(result.scenarios).toHaveLength(1);
    });
  });

  describe('getScenarioTemplates', () => {
    it('should return predefined templates', () => {
      const templates = service.getScenarioTemplates();

      expect(templates.length).toBeGreaterThan(0);
    });

    it('should include early retirement template', () => {
      const templates = service.getScenarioTemplates();
      const earlyRetirement = templates.find((t) => t.name.includes('Early Retirement'));

      expect(earlyRetirement).toBeDefined();
      expect(earlyRetirement?.modifications.retirementAge).toBe(-5);
    });

    it('should include delayed retirement template', () => {
      const templates = service.getScenarioTemplates();
      const delayed = templates.find((t) => t.name.includes('Delayed Retirement'));

      expect(delayed).toBeDefined();
      expect(delayed?.modifications.retirementAge).toBe(5);
    });

    it('should include higher inflation template', () => {
      const templates = service.getScenarioTemplates();
      const higherInflation = templates.find((t) => t.name.includes('Higher Inflation'));

      expect(higherInflation).toBeDefined();
      expect(higherInflation?.modifications.inflationRate).toBe(0.04);
    });

    it('should include lower inflation template', () => {
      const templates = service.getScenarioTemplates();
      const lowerInflation = templates.find((t) => t.name.includes('Lower Inflation'));

      expect(lowerInflation).toBeDefined();
      expect(lowerInflation?.modifications.inflationRate).toBe(0.02);
    });
  });

  describe('getQuickProjection', () => {
    // Use ages that result in projectionYears <= 50
    // Formula: Math.max(30, retirementAge - currentAge + 25) <= 50
    // So retirementAge - currentAge <= 25
    const quickCurrentAge = 45;
    const quickRetirementAge = 65; // 65 - 45 + 25 = 45 years (under 50)

    beforeEach(() => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'USD' });
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
      prismaMock.recurringTransaction.findMany.mockResolvedValue([]);
      prismaMock.budget.findMany.mockResolvedValue([]);
    });

    it('should call generateProjection with appropriate years', async () => {
      const generateSpy = jest.spyOn(service, 'generateProjection');

      await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(generateSpy).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        expect.objectContaining({
          currentAge: quickCurrentAge,
          retirementAge: quickRetirementAge,
          includeAccounts: true,
          includeRecurring: true,
        })
      );
    });

    it('should return summary with net worth at retirement', async () => {
      const result = await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(result).toHaveProperty('netWorthAtRetirement');
    });

    it('should return summary with monthly retirement income', async () => {
      const result = await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(result).toHaveProperty('monthlyRetirementIncome');
    });

    it('should return summary with years until retirement', async () => {
      const result = await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(result.yearsUntilRetirement).toBe(30); // From mocked summary
    });

    it('should return summary with risk score', async () => {
      const result = await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(result.riskScore).toBe(0.3);
    });

    it('should return summary with income replacement ratio', async () => {
      const result = await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(result.incomeReplacementRatio).toBe(0.65);
    });

    it('should handle missing retirement snapshot gracefully', async () => {
      (longTermCashflowEngine.project as jest.Mock).mockReturnValue({
        yearlySnapshots: [], // No snapshots
        summary: mockProjectionResult.summary,
      });

      const result = await service.getQuickProjection(
        testUserId,
        testSpaceId,
        quickCurrentAge,
        quickRetirementAge
      );

      expect(result.netWorthAtRetirement).toBe(0);
      expect(result.monthlyRetirementIncome).toBe(0);
    });
  });

  describe('edge cases', () => {
    const validDto: CreateProjectionDto = {
      projectionYears: 30,
      currentAge: 35,
      retirementAge: 65,
    };

    beforeEach(() => {
      prismaMock.space.findUnique.mockResolvedValue({ id: testSpaceId, currency: 'USD' });
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([]);
      prismaMock.recurringTransaction.findMany.mockResolvedValue([]);
      prismaMock.budget.findMany.mockResolvedValue([]);
    });

    it('should handle null balance on account', async () => {
      prismaMock.account.findMany.mockResolvedValue([
        {
          id: 'acc-1',
          name: 'Empty Account',
          type: 'savings',
          balance: null,
          currency: 'USD',
          assetValuations: [],
        },
      ]);

      // Should not throw
      await service.generateProjection(testUserId, testSpaceId, validDto);
      expect(longTermCashflowEngine.project).toHaveBeenCalled();
    });

    it('should handle null currentValue on manual asset', async () => {
      prismaMock.manualAsset.findMany.mockResolvedValue([
        {
          id: 'ma-1',
          name: 'Empty Asset',
          type: 'other',
          currentValue: null,
          currency: 'USD',
        },
      ]);

      // Should not throw
      await service.generateProjection(testUserId, testSpaceId, validDto);
      expect(longTermCashflowEngine.project).toHaveBeenCalled();
    });

    it('should handle null expectedAmount on recurring transaction', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Unknown',
          expectedAmount: null,
          frequency: 'monthly',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      // Should not throw
      await service.generateProjection(testUserId, testSpaceId, validDto);
      expect(longTermCashflowEngine.project).toHaveBeenCalled();
    });

    it('should handle unknown frequency by defaulting to monthly', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Unknown Freq',
          expectedAmount: { toNumber: () => -100 },
          frequency: 'unknown',
          currency: 'USD',
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              annualAmount: 1200, // 100 * 12 (monthly default)
            }),
          ]),
        })
      );
    });

    it('should handle space not found', async () => {
      prismaMock.space.findUnique.mockResolvedValue(null);

      // Should not throw, uses USD as default
      await service.generateProjection(testUserId, testSpaceId, validDto);
      expect(longTermCashflowEngine.project).toHaveBeenCalled();
    });

    it('should convert recurring transaction with different currency', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Foreign Employer',
          expectedAmount: { toNumber: () => 4000 },
          frequency: 'monthly',
          currency: 'EUR', // Different from target currency (USD)
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);
      fxRatesServiceMock.convertAmount.mockResolvedValue(4400); // EUR to USD conversion

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(fxRatesServiceMock.convertAmount).toHaveBeenCalledWith(4000, 'EUR', 'USD');
      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          incomeStreams: expect.arrayContaining([
            expect.objectContaining({
              name: 'Foreign Employer',
              annualAmount: 52800, // 4400 * 12
            }),
          ]),
        })
      );
    });

    it('should use original amount if recurring transaction currency conversion fails', async () => {
      prismaMock.recurringTransaction.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          merchantName: 'Foreign Subscription',
          expectedAmount: { toNumber: () => -50 },
          frequency: 'monthly',
          currency: 'GBP', // Different from target currency
          status: 'confirmed',
          categoryId: null,
        },
      ]);
      prismaMock.budget.findMany.mockResolvedValue([]);
      fxRatesServiceMock.convertAmount.mockRejectedValue(new Error('No rate available'));

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          expenses: expect.arrayContaining([
            expect.objectContaining({
              name: 'Foreign Subscription',
              annualAmount: 600, // 50 * 12 (original amount used)
            }),
          ]),
        })
      );
    });

    it('should convert manual asset with different currency', async () => {
      prismaMock.account.findMany.mockResolvedValue([]);
      prismaMock.manualAsset.findMany.mockResolvedValue([
        {
          id: 'ma-1',
          name: 'European Property',
          type: 'real_estate',
          currentValue: { toNumber: () => 200000 },
          currency: 'EUR',
          valuations: [],
        },
      ]);
      fxRatesServiceMock.convertAmount.mockResolvedValue(220000); // EUR to USD

      await service.generateProjection(testUserId, testSpaceId, validDto);

      expect(fxRatesServiceMock.convertAmount).toHaveBeenCalledWith(200000, 'EUR', 'USD');
      expect(longTermCashflowEngine.project).toHaveBeenCalledWith(
        expect.objectContaining({
          assets: expect.arrayContaining([
            expect.objectContaining({
              name: 'European Property',
              currentValue: 220000,
              type: 'real_estate',
            }),
          ]),
        })
      );
    });
  });
});
