import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PostHogService } from '../analytics/posthog.service';

import { BudgetsAnalytics, AlertType } from './budgets.analytics';

describe('BudgetsAnalytics', () => {
  let service: BudgetsAnalytics;
  let posthogService: jest.Mocked<PostHogService>;

  const mockPostHogService = {
    capture: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsAnalytics,
        {
          provide: PostHogService,
          useValue: mockPostHogService,
        },
      ],
    }).compile();

    // Suppress logger output
    module.get<BudgetsAnalytics>(BudgetsAnalytics)['logger'] = {
      error: jest.fn(),
    } as any;

    service = module.get<BudgetsAnalytics>(BudgetsAnalytics);
    posthogService = module.get(PostHogService);
  });

  describe('trackBudgetCreated', () => {
    it('should track budget creation', async () => {
      await service.trackBudgetCreated('user-123', {
        period: 'monthly',
        categoriesCount: 10,
        totalAmount: 5000,
        currency: 'MXN',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'budget_created',
        properties: {
          budget_period: 'monthly',
          categories_count: 10,
          total_amount: 5000,
          currency: 'MXN',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackBudgetCreated('user-123', {
          period: 'weekly',
          categoriesCount: 5,
          totalAmount: 1000,
          currency: 'USD',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackBudgetUpdated', () => {
    it('should track budget updates with changes', async () => {
      await service.trackBudgetUpdated('user-123', 'budget-456', ['amount', 'categories']);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'budget_updated',
        properties: {
          budget_id: 'budget-456',
          changes: ['amount', 'categories'],
        },
      });
    });

    it('should track single change', async () => {
      await service.trackBudgetUpdated('user-789', 'budget-123', ['period']);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'budget_updated',
        properties: {
          budget_id: 'budget-123',
          changes: ['period'],
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackBudgetUpdated('user-123', 'budget-456', ['name'])
      ).resolves.not.toThrow();
    });
  });

  describe('trackBudgetDeleted', () => {
    it('should track budget deletion', async () => {
      await service.trackBudgetDeleted('user-123', 'budget-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'budget_deleted',
        properties: {
          budget_id: 'budget-456',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackBudgetDeleted('user-123', 'budget-789')).resolves.not.toThrow();
    });
  });

  describe('trackRuleCreated', () => {
    it('should track categorization rule creation', async () => {
      await service.trackRuleCreated('user-123', {
        ruleType: 'merchant',
        categoryName: 'Groceries',
        conditions: 3,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'rule_created',
        properties: {
          rule_type: 'merchant',
          category_name: 'Groceries',
          conditions_count: 3,
        },
      });
    });

    it('should track rule with single condition', async () => {
      await service.trackRuleCreated('user-456', {
        ruleType: 'amount',
        categoryName: 'Large Expenses',
        conditions: 1,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'rule_created',
        properties: {
          rule_type: 'amount',
          category_name: 'Large Expenses',
          conditions_count: 1,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackRuleCreated('user-123', {
          ruleType: 'description',
          categoryName: 'Subscriptions',
          conditions: 2,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackRuleUpdated', () => {
    it('should track rule update', async () => {
      await service.trackRuleUpdated('user-123', 'rule-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'rule_updated',
        properties: {
          rule_id: 'rule-456',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackRuleUpdated('user-123', 'rule-789')).resolves.not.toThrow();
    });
  });

  describe('trackRuleDeleted', () => {
    it('should track rule deletion', async () => {
      await service.trackRuleDeleted('user-123', 'rule-456');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'rule_deleted',
        properties: {
          rule_id: 'rule-456',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackRuleDeleted('user-123', 'rule-789')).resolves.not.toThrow();
    });
  });

  describe('trackAlertFired', () => {
    it('should track budget limit alert with all properties', async () => {
      await service.trackAlertFired('user-123', {
        type: AlertType.BUDGET_LIMIT,
        categoryName: 'Dining',
        amount: 1500,
        threshold: 1000,
        percentUsed: 150,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'alert_fired',
        properties: {
          alert_type: 'budget_limit',
          category_name: 'Dining',
          amount: 1500,
          threshold: 1000,
          percent_used: 150,
        },
      });
    });

    it('should track unusual spending alert', async () => {
      await service.trackAlertFired('user-456', {
        type: AlertType.UNUSUAL_SPENDING,
        categoryName: 'Shopping',
        amount: 5000,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'alert_fired',
        properties: {
          alert_type: 'unusual_spending',
          category_name: 'Shopping',
          amount: 5000,
          threshold: undefined,
          percent_used: undefined,
        },
      });
    });

    it('should track large transaction alert', async () => {
      await service.trackAlertFired('user-789', {
        type: AlertType.LARGE_TRANSACTION,
        amount: 10000,
        threshold: 5000,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'alert_fired',
        properties: {
          alert_type: 'large_transaction',
          category_name: undefined,
          amount: 10000,
          threshold: 5000,
          percent_used: undefined,
        },
      });
    });

    it('should track low balance alert', async () => {
      await service.trackAlertFired('user-123', {
        type: AlertType.LOW_BALANCE,
        amount: 100,
        threshold: 500,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'alert_fired',
        properties: {
          alert_type: 'low_balance',
          category_name: undefined,
          amount: 100,
          threshold: 500,
          percent_used: undefined,
        },
      });
    });

    it('should track custom alert type', async () => {
      await service.trackAlertFired('user-456', {
        type: 'custom_alert',
        categoryName: 'Travel',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'alert_fired',
        properties: {
          alert_type: 'custom_alert',
          category_name: 'Travel',
          amount: undefined,
          threshold: undefined,
          percent_used: undefined,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackAlertFired('user-123', {
          type: AlertType.BILL_DUE,
          amount: 200,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackAlertAcknowledged', () => {
    it('should track alert acknowledgment', async () => {
      await service.trackAlertAcknowledged('user-123', 'alert-456', 'budget_limit');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'alert_acknowledged',
        properties: {
          alert_id: 'alert-456',
          alert_type: 'budget_limit',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackAlertAcknowledged('user-123', 'alert-789', 'low_balance')
      ).resolves.not.toThrow();
    });
  });

  describe('trackCategoryCreated', () => {
    it('should track category creation with budgeted amount', async () => {
      await service.trackCategoryCreated('user-123', 'Entertainment', 500);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'category_created',
        properties: {
          category_name: 'Entertainment',
          budgeted_amount: 500,
        },
      });
    });

    it('should track category creation without budgeted amount', async () => {
      await service.trackCategoryCreated('user-456', 'Miscellaneous');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'category_created',
        properties: {
          category_name: 'Miscellaneous',
          budgeted_amount: undefined,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackCategoryCreated('user-123', 'Utilities', 300)
      ).resolves.not.toThrow();
    });
  });

  describe('trackBudgetOverspend', () => {
    it('should track budget overspend with percentage calculation', async () => {
      await service.trackBudgetOverspend('user-123', 'Dining', 1000, 1500, 500);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'budget_overspend',
        properties: {
          category_name: 'Dining',
          budgeted_amount: 1000,
          spent_amount: 1500,
          overspend_amount: 500,
          percent_over: '50.00',
        },
      });
    });

    it('should calculate percentage correctly for large overspend', async () => {
      await service.trackBudgetOverspend('user-456', 'Shopping', 500, 1500, 1000);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'budget_overspend',
        properties: {
          category_name: 'Shopping',
          budgeted_amount: 500,
          spent_amount: 1500,
          overspend_amount: 1000,
          percent_over: '200.00',
        },
      });
    });

    it('should handle small overspend percentages', async () => {
      await service.trackBudgetOverspend('user-789', 'Groceries', 1000, 1025, 25);

      const captureCall = posthogService.capture.mock.calls[0][0];
      expect(captureCall.properties.percent_over).toBe('2.50');
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackBudgetOverspend('user-123', 'Travel', 2000, 2500, 500)
      ).resolves.not.toThrow();
    });
  });

  describe('trackBudgetDashboardViewed', () => {
    it('should track budget dashboard view with period', async () => {
      await service.trackBudgetDashboardViewed('user-123', 'monthly');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'budget_dashboard_viewed',
        properties: {
          period: 'monthly',
        },
      });
    });

    it('should track different budget periods', async () => {
      await service.trackBudgetDashboardViewed('user-456', 'weekly');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'budget_dashboard_viewed',
        properties: {
          period: 'weekly',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackBudgetDashboardViewed('user-123', 'yearly')).resolves.not.toThrow();
    });
  });
});
