import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PostHogService } from '../analytics/posthog.service';

import { TransactionsAnalytics } from './transactions.analytics';

describe('TransactionsAnalytics', () => {
  let service: TransactionsAnalytics;
  let posthogService: jest.Mocked<PostHogService>;

  const mockPostHogService = {
    capture: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsAnalytics,
        {
          provide: PostHogService,
          useValue: mockPostHogService,
        },
      ],
    }).compile();

    // Suppress logger output
    module.get<TransactionsAnalytics>(TransactionsAnalytics)['logger'] = {
      error: jest.fn(),
    } as any;

    service = module.get<TransactionsAnalytics>(TransactionsAnalytics);
    posthogService = module.get(PostHogService);
  });

  describe('trackTransactionCategorized', () => {
    it('should track auto-categorized transaction', async () => {
      await service.trackTransactionCategorized('user-123', 'auto', 'Groceries');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'txn_categorized',
        properties: {
          categorization_method: 'auto',
          category_name: 'Groceries',
        },
      });
    });

    it('should track manually categorized transaction', async () => {
      await service.trackTransactionCategorized('user-456', 'manual', 'Dining');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'txn_categorized',
        properties: {
          categorization_method: 'manual',
          category_name: 'Dining',
        },
      });
    });

    it('should track rule-based categorization', async () => {
      await service.trackTransactionCategorized('user-789', 'rule', 'Subscriptions');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'txn_categorized',
        properties: {
          categorization_method: 'rule',
          category_name: 'Subscriptions',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackTransactionCategorized('user-123', 'auto', 'Shopping')
      ).resolves.not.toThrow();
    });
  });

  describe('trackBulkCategorization', () => {
    it('should track bulk rule-based categorization', async () => {
      await service.trackBulkCategorization('user-123', 25, 'rule', 'rule-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'txn_bulk_categorized',
        properties: {
          transaction_count: 25,
          categorization_method: 'rule',
          rule_id: 'rule-456',
        },
      });
    });

    it('should track bulk manual categorization without rule', async () => {
      await service.trackBulkCategorization('user-456', 10, 'manual');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'txn_bulk_categorized',
        properties: {
          transaction_count: 10,
          categorization_method: 'manual',
          rule_id: undefined,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackBulkCategorization('user-123', 50, 'rule', 'rule-789')
      ).resolves.not.toThrow();
    });
  });

  describe('trackTransactionCreated', () => {
    it('should track transaction creation with all properties', async () => {
      await service.trackTransactionCreated('user-123', {
        amount: 250.5,
        currency: 'MXN',
        category: 'Groceries',
        type: 'expense',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_created',
        properties: {
          amount: 250.5,
          currency: 'MXN',
          category: 'Groceries',
          transaction_type: 'expense',
        },
      });
    });

    it('should track income transaction', async () => {
      await service.trackTransactionCreated('user-456', {
        amount: 5000,
        currency: 'USD',
        category: 'Salary',
        type: 'income',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'transaction_created',
        properties: {
          amount: 5000,
          currency: 'USD',
          category: 'Salary',
          transaction_type: 'income',
        },
      });
    });

    it('should track transaction without category', async () => {
      await service.trackTransactionCreated('user-789', {
        amount: 100,
        currency: 'EUR',
        type: 'transfer',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'transaction_created',
        properties: {
          amount: 100,
          currency: 'EUR',
          category: undefined,
          transaction_type: 'transfer',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackTransactionCreated('user-123', {
          amount: 75,
          currency: 'MXN',
          type: 'expense',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackTransactionUpdated', () => {
    it('should track transaction update with changes', async () => {
      await service.trackTransactionUpdated('user-123', 'txn-456', ['amount', 'category']);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_updated',
        properties: {
          transaction_id: 'txn-456',
          changes: ['amount', 'category'],
        },
      });
    });

    it('should track single field update', async () => {
      await service.trackTransactionUpdated('user-789', 'txn-123', ['description']);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'transaction_updated',
        properties: {
          transaction_id: 'txn-123',
          changes: ['description'],
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackTransactionUpdated('user-123', 'txn-789', ['date'])
      ).resolves.not.toThrow();
    });
  });

  describe('trackTransactionDeleted', () => {
    it('should track transaction deletion', async () => {
      await service.trackTransactionDeleted('user-123', 'txn-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_deleted',
        properties: {
          transaction_id: 'txn-456',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackTransactionDeleted('user-123', 'txn-789')).resolves.not.toThrow();
    });
  });

  describe('trackTransactionSplit', () => {
    it('should track 2-way transaction split', async () => {
      await service.trackTransactionSplit('user-123', 'txn-456', 2);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_split',
        properties: {
          original_transaction_id: 'txn-456',
          split_count: 2,
        },
      });
    });

    it('should track multi-way split', async () => {
      await service.trackTransactionSplit('user-789', 'txn-123', 5);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'transaction_split',
        properties: {
          original_transaction_id: 'txn-123',
          split_count: 5,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackTransactionSplit('user-123', 'txn-456', 3)).resolves.not.toThrow();
    });
  });

  describe('trackTransactionViewed', () => {
    it('should track transaction view', async () => {
      await service.trackTransactionViewed('user-123', 'txn-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_viewed',
        properties: {
          transaction_id: 'txn-456',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackTransactionViewed('user-123', 'txn-789')).resolves.not.toThrow();
    });
  });

  describe('trackTransactionSearch', () => {
    it('should track search with all filters', async () => {
      await service.trackTransactionSearch('user-123', {
        searchTerm: 'amazon',
        category: 'Shopping',
        dateRange: '2023-01-01 to 2023-12-31',
        amountRange: '100-1000',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_search',
        properties: {
          has_search_term: true,
          has_category_filter: true,
          has_date_filter: true,
          has_amount_filter: true,
        },
      });
    });

    it('should track search with only search term', async () => {
      await service.trackTransactionSearch('user-456', {
        searchTerm: 'uber',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'transaction_search',
        properties: {
          has_search_term: true,
          has_category_filter: false,
          has_date_filter: false,
          has_amount_filter: false,
        },
      });
    });

    it('should track search with only filters', async () => {
      await service.trackTransactionSearch('user-789', {
        category: 'Dining',
        dateRange: 'last-30-days',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'transaction_search',
        properties: {
          has_search_term: false,
          has_category_filter: true,
          has_date_filter: true,
          has_amount_filter: false,
        },
      });
    });

    it('should track search with no filters', async () => {
      await service.trackTransactionSearch('user-123', {});

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_search',
        properties: {
          has_search_term: false,
          has_category_filter: false,
          has_date_filter: false,
          has_amount_filter: false,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackTransactionSearch('user-123', { searchTerm: 'test' })
      ).resolves.not.toThrow();
    });
  });

  describe('trackTransactionExport', () => {
    it('should track CSV export', async () => {
      await service.trackTransactionExport('user-123', 'csv', 250);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'transaction_export',
        properties: {
          export_format: 'csv',
          transaction_count: 250,
        },
      });
    });

    it('should track PDF export', async () => {
      await service.trackTransactionExport('user-456', 'pdf', 100);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'transaction_export',
        properties: {
          export_format: 'pdf',
          transaction_count: 100,
        },
      });
    });

    it('should track JSON export', async () => {
      await service.trackTransactionExport('user-789', 'json', 500);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'transaction_export',
        properties: {
          export_format: 'json',
          transaction_count: 500,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackTransactionExport('user-123', 'csv', 150)).resolves.not.toThrow();
    });
  });

  describe('trackRecurringDetected', () => {
    it('should track recurring transaction detection', async () => {
      await service.trackRecurringDetected('user-123', 'Netflix', 'monthly', 0.95);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'recurring_detected',
        properties: {
          merchant: 'Netflix',
          frequency: 'monthly',
          confidence: 0.95,
        },
      });
    });

    it('should track weekly recurring pattern', async () => {
      await service.trackRecurringDetected('user-456', 'Uber Eats', 'weekly', 0.82);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'recurring_detected',
        properties: {
          merchant: 'Uber Eats',
          frequency: 'weekly',
          confidence: 0.82,
        },
      });
    });

    it('should track annual recurring pattern', async () => {
      await service.trackRecurringDetected('user-789', 'Amazon Prime', 'yearly', 1.0);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'recurring_detected',
        properties: {
          merchant: 'Amazon Prime',
          frequency: 'yearly',
          confidence: 1.0,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackRecurringDetected('user-123', 'Spotify', 'monthly', 0.88)
      ).resolves.not.toThrow();
    });
  });
});
