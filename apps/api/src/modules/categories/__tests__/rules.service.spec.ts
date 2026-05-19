import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';
import { Decimal } from '@db';

import { RulesService, CategoryRule, RuleCondition } from '../rules.service';

describe('RulesService - Business Logic Tests', () => {
  let service: RulesService;
  let prisma: jest.Mocked<PrismaService>;

  const mockRule = {
    id: 'rule-123',
    spaceId: 'space-123',
    categoryId: 'category-groceries',
    name: 'Grocery Stores',
    priority: 100,
    conditions: [
      {
        field: 'description',
        operator: 'contains',
        value: 'grocery',
        caseInsensitive: true,
      },
    ],
    enabled: true,
  };

  const mockTransaction = {
    id: 'txn-123',
    accountId: 'account-123',
    amount: new Decimal(-50.0),
    currency: 'USD',
    description: 'WHOLE FOODS GROCERY STORE',
    merchant: 'Whole Foods',
    date: new Date('2025-11-15'),
    categoryId: null,
    pending: false,
    providerTransactionId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAccount = {
    id: 'account-123',
    spaceId: 'space-123',
    space: {
      id: 'space-123',
      name: 'Test Space',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        {
          provide: PrismaService,
          useValue: {
            transactionRule: {
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            transaction: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            account: {
              findUnique: jest.fn(),
            },
            category: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    jest.clearAllMocks();
  });

  describe('Rule CRUD Operations', () => {
    it('should create a new rule', async () => {
      // Arrange
      const conditions: RuleCondition[] = [
        {
          field: 'description',
          operator: 'contains',
          value: 'grocery',
          caseInsensitive: true,
        },
      ];
      prisma.transactionRule.create.mockResolvedValue(mockRule as any);

      // Act
      const result = await service.createRule(
        'space-123',
        'category-groceries',
        'Grocery Stores',
        conditions,
        100
      );

      // Assert
      expect(prisma.transactionRule.create).toHaveBeenCalledWith({
        data: {
          spaceId: 'space-123',
          categoryId: 'category-groceries',
          name: 'Grocery Stores',
          priority: 100,
          conditions: conditions,
          enabled: true,
        },
      });
      expect(result.name).toBe('Grocery Stores');
      expect(result.priority).toBe(100);
    });

    it('should update an existing rule', async () => {
      // Arrange
      const updates = {
        name: 'Updated Grocery Rule',
        priority: 200,
      };
      const updatedRule = { ...mockRule, ...updates };
      prisma.transactionRule.update.mockResolvedValue(updatedRule as any);

      // Act
      const result = await service.updateRule('rule-123', updates);

      // Assert
      expect(prisma.transactionRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
        data: updates,
      });
      expect(result.name).toBe('Updated Grocery Rule');
      expect(result.priority).toBe(200);
    });

    it('should delete a rule', async () => {
      // Arrange
      prisma.transactionRule.delete.mockResolvedValue(mockRule as any);

      // Act
      await service.deleteRule('rule-123');

      // Assert
      expect(prisma.transactionRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-123' },
      });
    });

    it('should get rules for a category', async () => {
      // Arrange
      prisma.transactionRule.findMany.mockResolvedValue([mockRule] as any);

      // Act
      const result = await service.getRulesForCategory('category-groceries');

      // Assert
      expect(prisma.transactionRule.findMany).toHaveBeenCalledWith({
        where: { categoryId: 'category-groceries' },
        orderBy: { priority: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Grocery Stores');
    });

    it('should get rules for a space ordered by priority descending', async () => {
      // Arrange
      const rule1 = { ...mockRule, id: 'rule-1', priority: 100 };
      const rule2 = { ...mockRule, id: 'rule-2', priority: 200 };
      const rule3 = { ...mockRule, id: 'rule-3', priority: 50 };
      prisma.transactionRule.findMany.mockResolvedValue([rule2, rule1, rule3] as any);

      // Act
      const result = await service.getRulesForSpace('space-123');

      // Assert
      expect(prisma.transactionRule.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-123' },
        orderBy: { priority: 'desc' },
      });
      expect(result).toHaveLength(3);
    });
  });

  describe('String Operator Evaluation', () => {
    it('should evaluate "contains" operator (case insensitive)', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'GROCERY',
            caseInsensitive: true,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: 'whole foods grocery store',
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should evaluate "contains" operator (case sensitive)', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'GROCERY',
            caseInsensitive: false,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: 'whole foods grocery store',
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(false); // Case mismatch
    });

    it('should evaluate "equals" operator', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'merchant',
            operator: 'equals',
            value: 'whole foods',
            caseInsensitive: true,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        merchant: 'Whole Foods',
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should evaluate "startsWith" operator', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'startsWith',
            value: 'amazon',
            caseInsensitive: true,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: 'Amazon Prime Membership',
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should evaluate "endsWith" operator', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'endsWith',
            value: 'inc',
            caseInsensitive: true,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: 'Google LLC',
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(false); // Ends with LLC, not INC
    });
  });

  describe('Numeric Operator Evaluation', () => {
    it('should evaluate "greaterThan" operator for amount', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Large Purchases',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'amount',
            operator: 'greaterThan',
            value: 100,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        amount: new Decimal(-150.0), // Absolute value: 150
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should evaluate "lessThan" operator for amount', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Small Purchases',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'amount',
            operator: 'lessThan',
            value: 10,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        amount: new Decimal(-5.5), // Absolute value: 5.50
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should evaluate "between" operator for amount', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Medium Purchases',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'amount',
            operator: 'between',
            value: 20,
            valueEnd: 100,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        amount: new Decimal(-50.0), // Absolute value: 50 (within range)
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for "between" without valueEnd', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'amount',
            operator: 'between',
            value: 20,
            // Missing valueEnd
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        amount: new Decimal(-50.0),
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(false);
    });

    it('should use absolute value for amount comparisons', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'amount',
            operator: 'equals',
            value: 50,
          },
        ],
      };

      const negativeTransaction = {
        ...mockTransaction,
        amount: new Decimal(-50.0), // Negative (expense)
      };

      const positiveTransaction = {
        ...mockTransaction,
        amount: new Decimal(50.0), // Positive (income)
      };

      // Act
      const resultNegative = (service as any).evaluateRule(rule, negativeTransaction);
      const resultPositive = (service as any).evaluateRule(rule, positiveTransaction);

      // Assert
      expect(resultNegative).toBe(true); // |-50| = 50
      expect(resultPositive).toBe(true); // |50| = 50
    });
  });

  describe('Multiple Conditions (AND Logic)', () => {
    it('should match when ALL conditions are satisfied', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Large Grocery Purchase',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'grocery',
            caseInsensitive: true,
          },
          {
            field: 'amount',
            operator: 'greaterThan',
            value: 40,
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: 'Whole Foods Grocery',
        amount: new Decimal(-50.0),
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });

    it('should NOT match when ANY condition fails', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Large Grocery Purchase',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'grocery',
            caseInsensitive: true,
          },
          {
            field: 'amount',
            operator: 'greaterThan',
            value: 100, // Amount too high
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: 'Whole Foods Grocery',
        amount: new Decimal(-50.0), // Less than 100
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(false); // Amount condition failed
    });
  });

  describe('Account Field Matching', () => {
    it('should match transactions from specific account', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Business Account',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'account',
            operator: 'equals',
            value: 'account-business-123',
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        accountId: 'account-business-123',
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Null/Empty Value Handling', () => {
    it('should handle null description gracefully', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'test',
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        description: null,
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(false); // null treated as empty string
    });

    it('should handle null merchant gracefully', () => {
      // Arrange
      const rule: CategoryRule = {
        id: 'rule-1',
        categoryId: 'cat-1',
        name: 'Test Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'merchant',
            operator: 'equals',
            value: 'test',
          },
        ],
      };

      const transaction = {
        ...mockTransaction,
        merchant: null,
      };

      // Act
      const result = (service as any).evaluateRule(rule, transaction);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Rule Priority and Ordering', () => {
    it('should apply rules in priority order (highest first)', async () => {
      // Arrange
      const lowPriorityRule: CategoryRule = {
        id: 'rule-low',
        categoryId: 'cat-generic',
        name: 'Generic Food',
        priority: 50,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'food',
          },
        ],
      };

      const highPriorityRule: CategoryRule = {
        id: 'rule-high',
        categoryId: 'cat-specific',
        name: 'Specific Grocery',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'whole foods',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      // Return high priority first (as expected from getRulesForSpace)
      prisma.transactionRule.findMany.mockResolvedValue([highPriorityRule, lowPriorityRule] as any);

      const transaction = {
        ...mockTransaction,
        description: 'WHOLE FOODS GROCERY',
      };

      // Act
      const categoryId = await service.categorizeTransaction(transaction);

      // Assert
      expect(categoryId).toBe('cat-specific'); // High priority matched first
    });

    it('should skip disabled rules', async () => {
      // Arrange
      const disabledRule: CategoryRule = {
        id: 'rule-disabled',
        categoryId: 'cat-disabled',
        name: 'Disabled Rule',
        priority: 200,
        enabled: false, // Disabled
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'grocery',
          },
        ],
      };

      const enabledRule: CategoryRule = {
        id: 'rule-enabled',
        categoryId: 'cat-enabled',
        name: 'Enabled Rule',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'description',
            operator: 'contains',
            value: 'grocery',
          },
        ],
      };

      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([disabledRule, enabledRule] as any);

      const transaction = {
        ...mockTransaction,
        description: 'grocery store',
      };

      // Act
      const categoryId = await service.categorizeTransaction(transaction);

      // Assert
      expect(categoryId).toBe('cat-enabled'); // Disabled rule skipped
    });
  });

  describe('Batch Categorization (N+1 Query Fix)', () => {
    it('should categorize multiple transactions efficiently', async () => {
      // Arrange
      const transactions = [
        { ...mockTransaction, id: 'txn-1', description: 'Grocery Store', categoryId: null },
        { ...mockTransaction, id: 'txn-2', description: 'Gas Station', categoryId: null },
        { ...mockTransaction, id: 'txn-3', description: 'Restaurant', categoryId: null },
      ];

      const rules: CategoryRule[] = [
        {
          id: 'rule-grocery',
          categoryId: 'cat-grocery',
          name: 'Groceries',
          priority: 100,
          enabled: true,
          conditions: [
            {
              field: 'description',
              operator: 'contains',
              value: 'grocery',
            },
          ],
        },
      ];

      prisma.transaction.findMany.mockResolvedValue(transactions as any);
      prisma.transactionRule.findMany.mockResolvedValue(rules as any);
      prisma.transaction.update.mockResolvedValue({} as any);

      // Act
      const result = await service.batchCategorizeTransactions('space-123');

      // Assert
      expect(prisma.transactionRule.findMany).toHaveBeenCalledTimes(1); // NOT 3 times!
      expect(result.total).toBe(3);
      expect(result.categorized).toBe(1); // Only grocery matched
    });

    it('should return zero categorized when no rules match', async () => {
      // Arrange
      const transactions = [
        { ...mockTransaction, id: 'txn-1', description: 'Unmatched Store', categoryId: null },
      ];

      prisma.transaction.findMany.mockResolvedValue(transactions as any);
      prisma.transactionRule.findMany.mockResolvedValue([] as any); // No rules

      // Act
      const result = await service.batchCategorizeTransactions('space-123');

      // Assert
      expect(result.total).toBe(1);
      expect(result.categorized).toBe(0);
    });

    it('should skip already categorized transactions', async () => {
      // Arrange
      const uncategorizedTxns = [
        { ...mockTransaction, id: 'txn-1', description: 'Grocery Store', categoryId: null },
      ];

      prisma.transaction.findMany.mockResolvedValue(uncategorizedTxns as any); // Only uncategorized
      prisma.transactionRule.findMany.mockResolvedValue([] as any);

      // Act
      await service.batchCategorizeTransactions('space-123');

      // Assert
      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: 'space-123' },
          categoryId: null, // Only uncategorized
        },
        include: {
          account: true,
        },
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should return null when account not found', async () => {
      // Arrange
      prisma.account.findUnique.mockResolvedValue(null);

      const transaction = mockTransaction;

      // Act
      const categoryId = await service.categorizeTransaction(transaction);

      // Assert
      expect(categoryId).toBeNull();
    });

    it('should return null when no rules match', async () => {
      // Arrange
      prisma.account.findUnique.mockResolvedValue(mockAccount as any);
      prisma.transactionRule.findMany.mockResolvedValue([
        {
          ...mockRule,
          conditions: [
            {
              field: 'description',
              operator: 'contains',
              value: 'nonexistent-pattern',
            },
          ],
        },
      ] as any);

      const transaction = {
        ...mockTransaction,
        description: 'Grocery Store',
      };

      // Act
      const categoryId = await service.categorizeTransaction(transaction);

      // Assert
      expect(categoryId).toBeNull();
    });

    it('should handle invalid operator gracefully', () => {
      // Arrange
      const invalidCondition: any = {
        field: 'description',
        operator: 'invalidOperator',
        value: 'test',
      };

      // Act
      const result = (service as any).applyOperator(
        'invalidOperator',
        'test string',
        'test',
        undefined,
        true
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should handle type mismatch (string operator on number field)', () => {
      // Arrange
      const result = (service as any).applyOperator(
        'contains',
        123, // Number
        'test', // String
        undefined,
        true
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('Common Rules Creation', () => {
    it('should create common rules from predefined patterns', async () => {
      // Arrange
      const categories = [
        { id: 'cat-1', name: 'Groceries', budgetId: 'budget-1' },
        { id: 'cat-2', name: 'Transportation', budgetId: 'budget-1' },
      ];

      prisma.category.findMany.mockResolvedValue(categories as any);
      prisma.transactionRule.create.mockImplementation((args: any) => {
        return Promise.resolve({
          id: `rule-${args.data.name}`,
          ...args.data,
        });
      });

      // Act
      const rules = await service.createCommonRules('space-123');

      // Assert
      expect(rules.length).toBeGreaterThan(0);
      expect(prisma.transactionRule.create).toHaveBeenCalled();
    });
  });
});
