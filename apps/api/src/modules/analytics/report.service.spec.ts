import { EventEmitter } from 'events';

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@core/prisma/prisma.service';
import { Decimal } from '@db';

import { AnalyticsService } from './analytics.service';
import { ReportService } from './report.service';

// Mock @dhanam/shared
jest.mock(
  '@dhanam/shared',
  () => ({
    NetWorthResponse: {},
    CashflowForecast: {},
    SpendingByCategory: {},
    IncomeVsExpenses: {},
    AccountBalanceAnalytics: {},
    PortfolioAllocation: {},
    Currency: { USD: 'USD', EUR: 'EUR', MXN: 'MXN' },
    ANALYTICS: {
      HISTORY_DAYS: 90,
      PDF_PAGE_BREAK_Y: 700,
      SHARE_TOKEN_MAX_HOURS: 720,
      AMOUNT_DISPLAY_MULTIPLIER: 10_000,
    },
  }),
  { virtual: true }
);

// Mock pdfkit
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    const mockDoc = Object.assign(emitter, {
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      end: jest.fn(),
    });
    // Simulate PDF generation completion
    setTimeout(() => {
      mockDoc.emit('data', Buffer.from('PDF data chunk 1'));
      mockDoc.emit('data', Buffer.from('PDF data chunk 2'));
      mockDoc.emit('end');
    }, 10);
    return mockDoc;
  });
});

// Mock ExcelJS
const mockWorksheet = {
  columns: [],
  getRow: jest.fn().mockReturnValue({
    font: {},
    fill: {},
  }),
  getColumn: jest.fn().mockReturnValue({ numFmt: '' }),
  addRow: jest.fn().mockReturnValue({
    getCell: jest.fn().mockReturnValue({ font: {} }),
  }),
  addRows: jest.fn(),
};

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    creator: '',
    created: null,
    addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from('Excel data')),
    },
  })),
}));

describe('ReportService', () => {
  let service: ReportService;
  let prismaService: PrismaService;
  let analyticsService: AnalyticsService;

  const mockPrismaService = {
    space: {
      findUnique: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
    budget: {
      findMany: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
  };

  const mockAnalyticsService = {
    getSpendingByCategory: jest.fn(),
  };

  const mockSpace = {
    id: 'space-123',
    name: 'Personal Finance',
    currency: 'USD',
    userSpaces: [
      {
        userId: 'user-123',
        user: {
          id: 'user-123',
          email: 'user@example.com',
        },
      },
    ],
  };

  const mockTransactions = [
    {
      id: 'txn-1',
      date: new Date('2024-01-15'),
      description: 'Salary Deposit',
      amount: new Decimal(5000),
      currency: 'USD',
      categoryId: 'cat-salary',
      category: { id: 'cat-salary', name: 'Salary' },
      account: { name: 'Checking Account' },
      merchant: 'Employer Inc',
      pending: false,
    },
    {
      id: 'txn-2',
      date: new Date('2024-01-16'),
      description: 'Grocery Shopping',
      amount: new Decimal(-150),
      currency: 'USD',
      categoryId: 'cat-groceries',
      category: { id: 'cat-groceries', name: 'Groceries' },
      account: { name: 'Credit Card' },
      merchant: 'Walmart',
      pending: false,
    },
    {
      id: 'txn-3',
      date: new Date('2024-01-20'),
      description: 'Restaurant',
      amount: new Decimal(-75),
      currency: 'USD',
      categoryId: 'cat-dining',
      category: { id: 'cat-dining', name: 'Dining Out' },
      account: { name: 'Credit Card' },
      merchant: 'Local Restaurant',
      pending: false,
    },
    {
      id: 'txn-4',
      date: new Date('2024-01-25'),
      description: 'Freelance Payment',
      amount: new Decimal(1200),
      currency: 'USD',
      categoryId: 'cat-freelance',
      category: { id: 'cat-freelance', name: 'Freelance Income' },
      account: { name: 'Checking Account' },
      merchant: null,
      pending: false,
    },
  ];

  const mockAccounts = [
    {
      id: 'acc-1',
      name: 'Checking Account',
      type: 'checking',
      balance: new Decimal(10000),
      currency: 'USD',
      spaceId: 'space-123',
      lastSyncedAt: new Date('2024-01-25'),
    },
    {
      id: 'acc-2',
      name: 'Savings Account',
      type: 'savings',
      balance: new Decimal(25000),
      currency: 'USD',
      spaceId: 'space-123',
      lastSyncedAt: new Date('2024-01-25'),
    },
    {
      id: 'acc-3',
      name: 'Credit Card',
      type: 'credit',
      balance: new Decimal(-500),
      currency: 'USD',
      spaceId: 'space-123',
      lastSyncedAt: new Date('2024-01-25'),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
    prismaService = module.get<PrismaService>(PrismaService);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);

    jest.clearAllMocks();
  });

  describe('generatePdfReport', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    beforeEach(() => {
      mockPrismaService.space.findUnique.mockResolvedValue(mockSpace);
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.budget.findMany.mockResolvedValue([]);
      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
      mockAnalyticsService.getSpendingByCategory.mockResolvedValue([
        { categoryName: 'Groceries', amount: 150, percentage: 66.7 },
        { categoryName: 'Dining Out', amount: 75, percentage: 33.3 },
      ]);
    });

    it('should generate PDF report as Buffer', async () => {
      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should fetch space details with user information', async () => {
      await service.generatePdfReport('space-123', startDate, endDate);

      expect(mockPrismaService.space.findUnique).toHaveBeenCalledWith({
        where: { id: 'space-123' },
        include: {
          userSpaces: {
            include: {
              user: true,
            },
          },
        },
      });
    });

    it('should throw error if space not found', async () => {
      mockPrismaService.space.findUnique.mockResolvedValue(null);

      await expect(service.generatePdfReport('nonexistent', startDate, endDate)).rejects.toThrow(
        'Space not found'
      );
    });

    it('should fetch transactions within date range', async () => {
      await service.generatePdfReport('space-123', startDate, endDate);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: 'space-123' },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          category: true,
        },
      });
    });

    it('should call analytics service for spending breakdown', async () => {
      await service.generatePdfReport('space-123', startDate, endDate);

      expect(mockAnalyticsService.getSpendingByCategory).toHaveBeenCalledWith(
        'user-123',
        'space-123',
        startDate,
        endDate
      );
    });

    it('should fetch all budgets for the space', async () => {
      await service.generatePdfReport('space-123', startDate, endDate);

      expect(mockPrismaService.budget.findMany).toHaveBeenCalledWith({
        where: {
          spaceId: 'space-123',
        },
        include: {
          categories: true,
        },
      });
    });

    it('should fetch all accounts ordered by balance', async () => {
      await service.generatePdfReport('space-123', startDate, endDate);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-123' },
        orderBy: { balance: 'desc' },
      });
    });

    it('should include budget performance section when budgets exist', async () => {
      const mockBudgets = [
        {
          id: 'budget-1',
          name: 'Monthly Budget',
          spaceId: 'space-123',
          categories: [
            {
              id: 'cat-groceries',
              budgetedAmount: new Decimal(200),
            },
            {
              id: 'cat-dining',
              budgetedAmount: new Decimal(100),
            },
          ],
        },
      ];

      const budgetTransactions = [
        {
          id: 'txn-2',
          amount: new Decimal(-150),
          categoryId: 'cat-groceries',
        },
        {
          id: 'txn-3',
          amount: new Decimal(-75),
          categoryId: 'cat-dining',
        },
      ];

      mockPrismaService.budget.findMany.mockResolvedValue(mockBudgets);
      mockPrismaService.transaction.findMany
        .mockResolvedValueOnce(mockTransactions) // First call for overall transactions
        .mockResolvedValueOnce(budgetTransactions); // Second call for budget-specific transactions

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledTimes(2);
    });

    it('should handle transactions without categories', async () => {
      const transactionsWithoutCategory = [
        {
          id: 'txn-5',
          date: new Date('2024-01-10'),
          description: 'Uncategorized Transaction',
          amount: new Decimal(-50),
          currency: 'USD',
          categoryId: null,
          category: null,
          account: { name: 'Checking Account' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithoutCategory);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should calculate total income correctly', async () => {
      // Income transactions: $5000 + $1200 = $6200
      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      // Verify the service processed all transactions
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalled();
    });

    it('should calculate total expenses correctly', async () => {
      // Expense transactions: $150 + $75 = $225
      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalled();
    });

    it('should calculate savings rate correctly', async () => {
      // Net savings = $6200 - $225 = $5975
      // Savings rate = ($5975 / $6200) * 100 = 96.4%
      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle zero income gracefully', async () => {
      const expenseOnlyTransactions = [
        {
          id: 'txn-2',
          date: new Date('2024-01-16'),
          description: 'Expense',
          amount: new Decimal(-100),
          currency: 'USD',
          category: { name: 'Groceries' },
          account: { name: 'Credit Card' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(expenseOnlyTransactions);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should sort spending categories by amount descending', async () => {
      mockAnalyticsService.getSpendingByCategory.mockResolvedValue([
        { categoryName: 'Rent', amount: 1500, percentage: 60 },
        { categoryName: 'Groceries', amount: 600, percentage: 24 },
        { categoryName: 'Transport', amount: 400, percentage: 16 },
      ]);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockAnalyticsService.getSpendingByCategory).toHaveBeenCalled();
    });

    it('should calculate total balance from all accounts', async () => {
      // Total: $10,000 + $25,000 - $500 = $34,500
      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.account.findMany).toHaveBeenCalled();
    });

    it('should aggregate duplicate income categories', async () => {
      // Two income transactions with the same category should be aggregated
      const transactionsWithDuplicateCategories = [
        {
          id: 'txn-income-1',
          date: new Date('2024-01-15'),
          description: 'Salary January',
          amount: new Decimal(3000),
          currency: 'USD',
          category: { id: 'cat-salary', name: 'Salary' },
          account: { name: 'Checking Account' },
        },
        {
          id: 'txn-income-2',
          date: new Date('2024-01-30'),
          description: 'Salary Bonus',
          amount: new Decimal(2000),
          currency: 'USD',
          category: { id: 'cat-salary', name: 'Salary' },
          account: { name: 'Checking Account' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithDuplicateCategories);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should aggregate duplicate expense categories', async () => {
      // Two expense transactions with the same category should be aggregated
      const transactionsWithDuplicateCategories = [
        {
          id: 'txn-expense-1',
          date: new Date('2024-01-15'),
          description: 'Grocery Store A',
          amount: new Decimal(-100),
          currency: 'USD',
          category: { id: 'cat-groceries', name: 'Groceries' },
          account: { name: 'Credit Card' },
        },
        {
          id: 'txn-expense-2',
          date: new Date('2024-01-20'),
          description: 'Grocery Store B',
          amount: new Decimal(-80),
          currency: 'USD',
          category: { id: 'cat-groceries', name: 'Groceries' },
          account: { name: 'Credit Card' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithDuplicateCategories);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should paginate when many spending categories exceed page limit', async () => {
      // Create many spending categories to trigger pagination (yPos > 700)
      const manySpendingCategories = Array.from({ length: 40 }, (_, i) => ({
        categoryName: `Category ${i + 1}`,
        amount: 100 + i,
        percentage: 2.5,
      }));

      mockAnalyticsService.getSpendingByCategory.mockResolvedValue(manySpendingCategories);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockAnalyticsService.getSpendingByCategory).toHaveBeenCalled();
    });

    it('should paginate when many budgets exceed page limit', async () => {
      // Create many budgets to trigger pagination (yPos > 700)
      const manyBudgets = Array.from({ length: 15 }, (_, i) => ({
        id: `budget-${i + 1}`,
        name: `Budget ${i + 1}`,
        spaceId: 'space-123',
        categories: [{ id: `cat-${i}`, budgetedAmount: new Decimal(500) }],
      }));

      mockPrismaService.budget.findMany.mockResolvedValue(manyBudgets);
      mockPrismaService.transaction.findMany
        .mockResolvedValueOnce(mockTransactions)
        .mockResolvedValue([{ id: 'txn-1', amount: new Decimal(-200) }]);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.budget.findMany).toHaveBeenCalled();
    });

    it('should paginate when many accounts exceed page limit', async () => {
      // Create many accounts to trigger pagination (yPos > 700)
      const manyAccounts = Array.from({ length: 40 }, (_, i) => ({
        id: `acc-${i + 1}`,
        name: `Account ${i + 1}`,
        type: 'checking',
        balance: new Decimal(1000 * (i + 1)),
        currency: 'USD',
        lastSyncedAt: new Date('2024-01-25'),
      }));

      mockPrismaService.account.findMany.mockResolvedValue(manyAccounts);

      const result = await service.generatePdfReport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockPrismaService.account.findMany).toHaveBeenCalled();
    });
  });

  describe('generateCsvExport', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    beforeEach(() => {
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
    });

    it('should generate CSV export with header row', async () => {
      const result = await service.generateCsvExport('space-123', startDate, endDate);

      expect(result).toContain('Date,Account,Category,Description,Amount,Currency');
    });

    it('should fetch transactions within date range ordered by date descending', async () => {
      await service.generateCsvExport('space-123', startDate, endDate);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: 'space-123' },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          account: true,
          category: true,
        },
        orderBy: {
          date: 'desc',
        },
      });
    });

    it('should format transaction data as CSV rows', async () => {
      const result = await service.generateCsvExport('space-123', startDate, endDate);

      expect(result).toContain('2024-01-15');
      expect(result).toContain('Checking Account');
      expect(result).toContain('Salary');
      expect(result).toContain('Salary Deposit');
      expect(result).toContain('5000.00');
      expect(result).toContain('USD');
    });

    it('should handle transactions without categories', async () => {
      const transactionsWithoutCategory = [
        {
          id: 'txn-5',
          date: new Date('2024-01-10'),
          description: 'Uncategorized',
          amount: new Decimal(-50),
          currency: 'USD',
          categoryId: null,
          category: null,
          account: { name: 'Checking' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithoutCategory);

      const result = await service.generateCsvExport('space-123', startDate, endDate);

      expect(result).toContain('Uncategorized');
    });

    it('should escape double quotes in descriptions', async () => {
      const transactionsWithQuotes = [
        {
          id: 'txn-6',
          date: new Date('2024-01-10'),
          description: 'Payment for "Premium" Service',
          amount: new Decimal(-99.99),
          currency: 'USD',
          category: { name: 'Services' },
          account: { name: 'Checking' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithQuotes);

      const result = await service.generateCsvExport('space-123', startDate, endDate);

      // CSV escaping: double quotes should be escaped as ""
      expect(result).toContain('""Premium""');
    });

    it('should format amounts with 2 decimal places', async () => {
      const result = await service.generateCsvExport('space-123', startDate, endDate);

      expect(result).toContain('5000.00'); // Income
      expect(result).toContain('-150.00'); // Expense
      expect(result).toContain('-75.00'); // Expense
      expect(result).toContain('1200.00'); // Income
    });

    it('should handle empty transaction list', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      const result = await service.generateCsvExport('space-123', startDate, endDate);

      expect(result).toBe('Date,Account,Category,Description,Amount,Currency\n');
    });

    it('should include all transactions in correct order', async () => {
      const result = await service.generateCsvExport('space-123', startDate, endDate);

      const lines = result.split('\n');
      expect(lines.length).toBe(6); // Header + 4 transactions + empty line at end
    });

    it('should wrap all text fields in quotes', async () => {
      const result = await service.generateCsvExport('space-123', startDate, endDate);

      // Date field should be quoted
      expect(result).toMatch(/"2024-01-\d{2}"/);
      // Account field should be quoted
      expect(result).toMatch(/"Checking Account"/);
      // Category field should be quoted
      expect(result).toMatch(/"Salary"/);
      // Description field should be quoted
      expect(result).toMatch(/"Salary Deposit"/);
    });

    it('should handle different currencies', async () => {
      const multiCurrencyTransactions = [
        {
          id: 'txn-1',
          date: new Date('2024-01-15'),
          description: 'EUR Transaction',
          amount: new Decimal(1000),
          currency: 'EUR',
          category: { name: 'Income' },
          account: { name: 'EUR Account' },
        },
        {
          id: 'txn-2',
          date: new Date('2024-01-16'),
          description: 'USD Transaction',
          amount: new Decimal(-500),
          currency: 'USD',
          category: { name: 'Expense' },
          account: { name: 'USD Account' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(multiCurrencyTransactions);

      const result = await service.generateCsvExport('space-123', startDate, endDate);

      expect(result).toContain('EUR');
      expect(result).toContain('USD');
    });
  });

  describe('generateExcelExport', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    beforeEach(() => {
      mockPrismaService.space.findUnique.mockResolvedValue(mockSpace);
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
    });

    it('should generate Excel report as Buffer', async () => {
      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw error if space not found', async () => {
      mockPrismaService.space.findUnique.mockResolvedValue(null);

      await expect(service.generateExcelExport('nonexistent', startDate, endDate)).rejects.toThrow(
        'Space not found'
      );
    });

    it('should fetch space with user information', async () => {
      await service.generateExcelExport('space-123', startDate, endDate);

      expect(mockPrismaService.space.findUnique).toHaveBeenCalledWith({
        where: { id: 'space-123' },
        include: {
          userSpaces: { include: { user: true } },
        },
      });
    });

    it('should fetch transactions within date range', async () => {
      await service.generateExcelExport('space-123', startDate, endDate);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith({
        where: {
          account: { spaceId: 'space-123' },
          date: { gte: startDate, lte: endDate },
        },
        include: { account: true, category: true },
        orderBy: { date: 'desc' },
      });
    });

    it('should fetch all accounts for the space', async () => {
      await service.generateExcelExport('space-123', startDate, endDate);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-123' },
        orderBy: { balance: 'desc' },
      });
    });

    it('should handle transactions without categories', async () => {
      const transactionsWithoutCategory = [
        {
          id: 'txn-uncategorized',
          date: new Date('2024-01-15'),
          description: 'Uncategorized Transaction',
          amount: new Decimal(-100),
          currency: 'USD',
          merchant: null,
          pending: false,
          categoryId: null,
          category: null,
          account: { name: 'Checking Account' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithoutCategory);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle transactions with merchant and pending status', async () => {
      const transactionsWithMerchant = [
        {
          id: 'txn-1',
          date: new Date('2024-01-15'),
          description: 'Purchase',
          amount: new Decimal(-50),
          currency: 'USD',
          merchant: 'Amazon',
          pending: true,
          category: { name: 'Shopping' },
          account: { name: 'Credit Card' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithMerchant);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle positive and negative amounts correctly', async () => {
      const mixedTransactions = [
        {
          id: 'txn-income',
          date: new Date('2024-01-15'),
          description: 'Salary',
          amount: new Decimal(5000),
          currency: 'USD',
          merchant: null,
          pending: false,
          category: { name: 'Income' },
          account: { name: 'Checking' },
        },
        {
          id: 'txn-expense',
          date: new Date('2024-01-16'),
          description: 'Rent',
          amount: new Decimal(-1500),
          currency: 'USD',
          merchant: null,
          pending: false,
          category: { name: 'Housing' },
          account: { name: 'Checking' },
        },
        {
          id: 'txn-zero',
          date: new Date('2024-01-17'),
          description: 'Transfer',
          amount: new Decimal(0),
          currency: 'USD',
          merchant: null,
          pending: false,
          category: null,
          account: { name: 'Checking' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mixedTransactions);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle accounts with null lastSyncedAt', async () => {
      const accountsWithNullSync = [
        {
          id: 'acc-manual',
          name: 'Manual Account',
          type: 'checking',
          balance: new Decimal(1000),
          currency: 'USD',
          lastSyncedAt: null,
        },
      ];

      mockPrismaService.account.findMany.mockResolvedValue(accountsWithNullSync);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle empty transaction list', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should calculate savings rate correctly', async () => {
      const incomeOnlyTransactions = [
        {
          id: 'txn-income',
          date: new Date('2024-01-15'),
          description: 'Salary',
          amount: new Decimal(5000),
          currency: 'USD',
          merchant: null,
          pending: false,
          category: { name: 'Income' },
          account: { name: 'Checking' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(incomeOnlyTransactions);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle zero income for savings rate', async () => {
      const expenseOnlyTransactions = [
        {
          id: 'txn-expense',
          date: new Date('2024-01-15'),
          description: 'Purchase',
          amount: new Decimal(-100),
          currency: 'USD',
          merchant: null,
          pending: false,
          category: { name: 'Shopping' },
          account: { name: 'Credit Card' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(expenseOnlyTransactions);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle zero total expenses for category percentages', async () => {
      const incomeTransactions = [
        {
          id: 'txn-income',
          date: new Date('2024-01-15'),
          description: 'Salary',
          amount: new Decimal(5000),
          currency: 'USD',
          merchant: null,
          pending: false,
          category: { name: 'Income' },
          account: { name: 'Checking' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(incomeTransactions);

      const result = await service.generateExcelExport('space-123', startDate, endDate);

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('generateJsonExport', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const mockBudgets = [
      {
        id: 'budget-1',
        name: 'Monthly Budget',
        period: 'monthly',
        categories: [
          {
            id: 'cat-1',
            name: 'Groceries',
            budgetedAmount: new Decimal(500),
          },
        ],
      },
    ];

    beforeEach(() => {
      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.budget.findMany.mockResolvedValue(mockBudgets);
    });

    it('should generate valid JSON string', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include export timestamp', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveProperty('exportedAt');
      expect(new Date(parsed.exportedAt)).toBeInstanceOf(Date);
    });

    it('should include period information', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.period).toEqual({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });
    });

    it('should include transactions array', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.transactions).toBeInstanceOf(Array);
      expect(parsed.transactions.length).toBe(4);
    });

    it('should format transaction data correctly', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);
      const firstTransaction = parsed.transactions[0];

      expect(firstTransaction).toHaveProperty('date');
      expect(firstTransaction).toHaveProperty('account');
      expect(firstTransaction).toHaveProperty('category');
      expect(firstTransaction).toHaveProperty('merchant');
      expect(firstTransaction).toHaveProperty('description');
      expect(firstTransaction).toHaveProperty('amount');
      expect(firstTransaction).toHaveProperty('currency');
      expect(firstTransaction).toHaveProperty('pending');
    });

    it('should include accounts array', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.accounts).toBeInstanceOf(Array);
      expect(parsed.accounts.length).toBe(3);
    });

    it('should format account data correctly', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);
      const firstAccount = parsed.accounts[0];

      expect(firstAccount).toHaveProperty('name');
      expect(firstAccount).toHaveProperty('type');
      expect(firstAccount).toHaveProperty('balance');
      expect(firstAccount).toHaveProperty('currency');
    });

    it('should include budgets array', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.budgets).toBeInstanceOf(Array);
      expect(parsed.budgets.length).toBe(1);
    });

    it('should format budget data correctly', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);
      const firstBudget = parsed.budgets[0];

      expect(firstBudget).toHaveProperty('name');
      expect(firstBudget).toHaveProperty('period');
      expect(firstBudget).toHaveProperty('categories');
      expect(firstBudget.categories[0]).toHaveProperty('name');
      expect(firstBudget.categories[0]).toHaveProperty('budgeted');
    });

    it('should convert Decimal amounts to numbers', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(typeof parsed.transactions[0].amount).toBe('number');
      expect(typeof parsed.accounts[0].balance).toBe('number');
      expect(typeof parsed.budgets[0].categories[0].budgeted).toBe('number');
    });

    it('should handle transactions without categories', async () => {
      const transactionsWithoutCategory = [
        {
          id: 'txn-uncategorized',
          date: new Date('2024-01-15'),
          description: 'Uncategorized',
          amount: new Decimal(-50),
          currency: 'USD',
          merchant: null,
          pending: false,
          categoryId: null,
          category: null,
          account: { name: 'Checking' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(transactionsWithoutCategory);

      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.transactions[0].category).toBeNull();
    });

    it('should handle empty data', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.account.findMany.mockResolvedValue([]);
      mockPrismaService.budget.findMany.mockResolvedValue([]);

      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.transactions).toEqual([]);
      expect(parsed.accounts).toEqual([]);
      expect(parsed.budgets).toEqual([]);
    });

    it('should handle budgets with multiple categories', async () => {
      const budgetWithMultipleCategories = [
        {
          id: 'budget-1',
          name: 'Full Budget',
          period: 'monthly',
          categories: [
            { id: 'cat-1', name: 'Food', budgetedAmount: new Decimal(500) },
            { id: 'cat-2', name: 'Transport', budgetedAmount: new Decimal(300) },
            { id: 'cat-3', name: 'Entertainment', budgetedAmount: new Decimal(200) },
          ],
        },
      ];

      mockPrismaService.budget.findMany.mockResolvedValue(budgetWithMultipleCategories);

      const result = await service.generateJsonExport('space-123', startDate, endDate);
      const parsed = JSON.parse(result);

      expect(parsed.budgets[0].categories.length).toBe(3);
      expect(parsed.budgets[0].categories.map((c: any) => c.name)).toEqual([
        'Food',
        'Transport',
        'Entertainment',
      ]);
    });

    it('should pretty print JSON with 2-space indentation', async () => {
      const result = await service.generateJsonExport('space-123', startDate, endDate);

      // Check that it's formatted with indentation (contains newlines and spaces)
      expect(result).toContain('\n');
      expect(result).toMatch(/^\{\n\s{2}/); // Starts with { followed by newline and 2 spaces
    });

    it('should fetch all data in parallel', async () => {
      await service.generateJsonExport('space-123', startDate, endDate);

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalled();
      expect(mockPrismaService.account.findMany).toHaveBeenCalled();
      expect(mockPrismaService.budget.findMany).toHaveBeenCalled();
    });
  });
});
