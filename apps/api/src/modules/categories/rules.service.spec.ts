import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

import { PrismaService } from '@core/prisma/prisma.service';
import { Transaction, Category, Decimal } from '@db';

import { RulesService } from './rules.service';

describe('RulesService', () => {
  let service: RulesService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockTransaction: Transaction = {
    id: 'tx1',
    accountId: 'acc1',
    providerTransactionId: 'provider-tx1',
    amount: new Decimal(-50.0),
    currency: 'USD',
    description: 'Starbucks Coffee',
    merchant: 'Starbucks',
    categoryId: null,
    date: new Date(),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategories: Category[] = [
    {
      id: 'cat1',
      budgetId: 'budget1',
      name: 'Dining',
      type: 'expense',
      limit: new Decimal(500),
      spent: new Decimal(100),
      currency: 'USD',
      period: 'monthly',
      isActive: true,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockRules = [
    {
      id: 'rule1',
      categoryId: 'cat1',
      name: 'Coffee Shops',
      priority: 100,
      enabled: true,
      conditions: [
        {
          field: 'merchant',
          operator: 'contains',
          value: 'starbucks',
          caseInsensitive: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        {
          provide: PrismaService,
          useValue: mockDeep<PrismaService>(),
        },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRule', () => {
    it('should create a categorization rule', async () => {
      const mockCreatedRule = { ...mockRules[0] };
      prisma.transactionRule.create.mockResolvedValue(mockCreatedRule as any);

      const result = await service.createRule(
        'space1',
        'cat1',
        'Coffee Shops',
        [
          {
            field: 'merchant',
            operator: 'contains',
            value: 'starbucks',
            caseInsensitive: true,
          },
        ],
        100
      );

      expect(result).toBeDefined();
      expect(result.name).toBe('Coffee Shops');
      expect(result.categoryId).toBe('cat1');
    });
  });

  describe('categorizeTransaction', () => {
    const mockAccount = {
      id: 'acc1',
      spaceId: 'space1',
      space: { id: 'space1' },
    };

    it('should categorize transaction using matching rule', async () => {
      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue(mockRules as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1');
    });

    it('should return null for transaction with no matching rules', async () => {
      const nonMatchingTransaction = {
        ...mockTransaction,
        merchant: 'Random Store',
        description: 'Random Purchase',
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue(mockRules as any);

      const result = await service.categorizeTransaction(nonMatchingTransaction);

      expect(result).toBeNull();
    });

    it('should handle amount-based rules', async () => {
      const amountRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'amount',
            operator: 'greaterThan',
            value: 100,
          },
        ],
      };

      const expensiveTransaction = {
        ...mockTransaction,
        amount: new Decimal(-150.0),
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([amountRule] as any);

      const result = await service.categorizeTransaction(expensiveTransaction);

      expect(result).toBe('cat1');
    });
  });

  describe('batchCategorizeTransactions', () => {
    const mockAccount = {
      id: 'acc1',
      spaceId: 'space1',
      space: { id: 'space1' },
    };

    it('should categorize multiple transactions', async () => {
      const mockTransactions = [mockTransaction];

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transaction.findMany.mockResolvedValue(mockTransactions);
      prisma.transactionRule.findMany.mockResolvedValue(mockRules as any);
      prisma.transaction.update.mockResolvedValue(mockTransaction);

      const result = await service.batchCategorizeTransactions('space1');

      expect(result).toBeDefined();
      expect(result.categorized).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('categorizeSpecificTransactions', () => {
    const mockAccount = {
      id: 'acc1',
      spaceId: 'space1',
      space: { id: 'space1' },
    };

    it('should categorize specific transactions by ID', async () => {
      const mockTransactions = [mockTransaction];

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transaction.findMany.mockResolvedValue(mockTransactions);
      prisma.transactionRule.findMany.mockResolvedValue(mockRules as any);
      prisma.transaction.update.mockResolvedValue(mockTransaction);

      const result = await service.categorizeSpecificTransactions('space1', ['tx1']);

      expect(result).toBeDefined();
      expect(result.categorized).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('createCommonRules', () => {
    it('should create common categorization rules', async () => {
      prisma.category.findMany.mockResolvedValue(mockCategories);
      prisma.transactionRule.create.mockResolvedValue(mockRules[0] as any);

      const result = await service.createCommonRules('space1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should skip patterns with no matching category (line 330 branch)', async () => {
      // Return categories that don't match any common pattern
      const nonMatchingCategories = [
        {
          ...mockCategories[0],
          name: 'Uncategorized',
        },
      ];
      prisma.category.findMany.mockResolvedValue(nonMatchingCategories);

      const result = await service.createCommonRules('space1');

      // No rules created since no category matches any pattern
      expect(result).toEqual([]);
      expect(prisma.transactionRule.create).not.toHaveBeenCalled();
    });

    it('should handle rule creation errors gracefully (line 347-349 branch)', async () => {
      const matchingCategory = {
        ...mockCategories[0],
        name: 'Groceries', // Matches "groceries" pattern
      };
      prisma.category.findMany.mockResolvedValue([matchingCategory]);
      prisma.transactionRule.create.mockRejectedValue(new Error('Database error'));

      const result = await service.createCommonRules('space1');

      // Should return empty array since all rules failed
      expect(result).toEqual([]);
    });
  });

  describe('categorizeTransaction edge cases', () => {
    it('should return null when account not found (line 110-113)', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    it('should skip disabled rules (line 119 branch)', async () => {
      const mockAccount = {
        id: 'acc1',
        spaceId: 'space1',
        space: { id: 'space1' },
      };
      const disabledRule = {
        ...mockRules[0],
        enabled: false,
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([disabledRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull();
    });
  });

  describe('evaluateCondition edge cases', () => {
    const mockAccount = {
      id: 'acc1',
      spaceId: 'space1',
      space: { id: 'space1' },
    };

    it('should return false for unknown field type (line 219-220)', async () => {
      const ruleWithUnknownField = {
        ...mockRules[0],
        conditions: [
          {
            field: 'unknownField', // Invalid field
            operator: 'contains',
            value: 'test',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([ruleWithUnknownField] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    it('should return false for unknown string operator (line 252-253)', async () => {
      const ruleWithUnknownOperator = {
        ...mockRules[0],
        conditions: [
          {
            field: 'merchant',
            operator: 'unknownOperator', // Invalid operator
            value: 'test',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([ruleWithUnknownOperator] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    it('should return false for unknown numeric operator (line 269-270)', async () => {
      const ruleWithUnknownNumericOperator = {
        ...mockRules[0],
        conditions: [
          {
            field: 'amount',
            operator: 'unknownNumericOp', // Invalid operator
            value: 100,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([ruleWithUnknownNumericOperator] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    it('should handle between operator with valueEnd (line 266-268)', async () => {
      const betweenRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'amount',
            operator: 'between',
            value: 40,
            valueEnd: 60,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([betweenRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1'); // 50 is between 40 and 60
    });

    it('should return false for between operator without valueEnd (line 266-268 else branch)', async () => {
      const betweenRuleNoEnd = {
        ...mockRules[0],
        conditions: [
          {
            field: 'amount',
            operator: 'between',
            value: 40,
            // valueEnd is undefined
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([betweenRuleNoEnd] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull();
    });

    it('should handle description field', async () => {
      const descriptionRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'coffee',
            caseInsensitive: true,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([descriptionRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1'); // Description contains "Coffee"
    });

    it('should handle account field', async () => {
      const accountRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'account',
            operator: 'equals',
            value: 'acc1',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([accountRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1');
    });

    it('should handle startsWith operator', async () => {
      const startsWithRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'merchant',
            operator: 'startsWith',
            value: 'star',
            caseInsensitive: true,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([startsWithRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1');
    });

    it('should handle endsWith operator', async () => {
      const endsWithRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'merchant',
            operator: 'endsWith',
            value: 'bucks',
            caseInsensitive: true,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([endsWithRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1');
    });

    it('should handle equals operator for strings', async () => {
      const equalsRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'merchant',
            operator: 'equals',
            value: 'starbucks',
            caseInsensitive: true,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([equalsRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1');
    });

    it('should handle lessThan operator for amounts', async () => {
      const lessThanRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'amount',
            operator: 'lessThan',
            value: 100,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([lessThanRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1'); // 50 < 100
    });

    it('should handle equals operator for amounts', async () => {
      const equalsAmountRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'amount',
            operator: 'equals',
            value: 50,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([equalsAmountRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBe('cat1');
    });

    it('should handle case-sensitive matching', async () => {
      const caseSensitiveRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'merchant',
            operator: 'contains',
            value: 'STARBUCKS', // Wrong case
            caseInsensitive: false,
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([caseSensitiveRule] as any);

      const result = await service.categorizeTransaction(mockTransaction);

      expect(result).toBeNull(); // Case-sensitive, so "Starbucks" doesn't match "STARBUCKS"
    });

    it('should handle null description', async () => {
      const transactionWithNullDesc = {
        ...mockTransaction,
        description: null,
      };
      const descRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'test',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([descRule] as any);

      const result = await service.categorizeTransaction(transactionWithNullDesc);

      expect(result).toBeNull();
    });

    it('should handle null merchant', async () => {
      const transactionWithNullMerchant = {
        ...mockTransaction,
        merchant: null,
      };
      const merchantRule = {
        ...mockRules[0],
        conditions: [
          {
            field: 'merchant',
            operator: 'contains',
            value: 'test',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([merchantRule] as any);

      const result = await service.categorizeTransaction(transactionWithNullMerchant);

      expect(result).toBeNull();
    });
  });

  describe('batchCategorizeTransactions edge cases', () => {
    it('should skip disabled rules in batch processing (line 186 branch)', async () => {
      const disabledRule = {
        ...mockRules[0],
        enabled: false,
      };

      prisma.transaction.findMany.mockResolvedValue([mockTransaction]);
      prisma.transactionRule.findMany.mockResolvedValue([disabledRule] as any);

      const result = await service.batchCategorizeTransactions('space1');

      expect(result.categorized).toBe(0);
      expect(prisma.transaction.update).not.toHaveBeenCalled();
    });

    it('should handle empty transaction list', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transactionRule.findMany.mockResolvedValue(mockRules as any);

      const result = await service.batchCategorizeTransactions('space1');

      expect(result.categorized).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});
