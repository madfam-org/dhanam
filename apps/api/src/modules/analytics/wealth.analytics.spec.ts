import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PostHogService } from './posthog.service';
import { WealthAnalytics } from './wealth.analytics';

describe('WealthAnalytics', () => {
  let service: WealthAnalytics;
  let posthogService: jest.Mocked<PostHogService>;

  const mockPostHogService = {
    capture: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WealthAnalytics,
        {
          provide: PostHogService,
          useValue: mockPostHogService,
        },
      ],
    }).compile();

    // Suppress logger output
    module.get<WealthAnalytics>(WealthAnalytics)['logger'] = {
      error: jest.fn(),
    } as any;

    service = module.get<WealthAnalytics>(WealthAnalytics);
    posthogService = module.get(PostHogService);
  });

  describe('trackNetWorthViewed', () => {
    it('should track net worth view with change data', async () => {
      await service.trackNetWorthViewed('user-123', 250000, 'USD', {
        amount: 15000,
        percentage: 6.38,
        period: 'month',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'view_net_worth',
        properties: {
          net_worth: 250000,
          currency: 'USD',
          change_amount: 15000,
          change_percentage: 6.38,
          change_period: 'month',
        },
      });
    });

    it('should track net worth view without change data', async () => {
      await service.trackNetWorthViewed('user-456', 100000, 'MXN');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'view_net_worth',
        properties: {
          net_worth: 100000,
          currency: 'MXN',
          change_amount: undefined,
          change_percentage: undefined,
          change_period: undefined,
        },
      });
    });

    it('should track negative net worth change', async () => {
      await service.trackNetWorthViewed('user-789', 500000, 'EUR', {
        amount: -25000,
        percentage: -4.76,
        period: 'quarter',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'view_net_worth',
        properties: {
          net_worth: 500000,
          currency: 'EUR',
          change_amount: -25000,
          change_percentage: -4.76,
          change_period: 'quarter',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackNetWorthViewed('user-123', 300000, 'USD')).resolves.not.toThrow();
    });
  });

  describe('trackDataExported', () => {
    it('should track transaction export as CSV', async () => {
      await service.trackDataExported('user-123', 'transactions', 'csv');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'export_data',
        properties: {
          export_type: 'transactions',
          format: 'csv',
        },
      });
    });

    it('should track budget export as PDF', async () => {
      await service.trackDataExported('user-456', 'budgets', 'pdf');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'export_data',
        properties: {
          export_type: 'budgets',
          format: 'pdf',
        },
      });
    });

    it('should track full data export as JSON', async () => {
      await service.trackDataExported('user-789', 'full', 'json');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'export_data',
        properties: {
          export_type: 'full',
          format: 'json',
        },
      });
    });

    it('should track net worth export as XLSX', async () => {
      await service.trackDataExported('user-123', 'net_worth', 'xlsx');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'export_data',
        properties: {
          export_type: 'net_worth',
          format: 'xlsx',
        },
      });
    });

    it('should track tax report export', async () => {
      await service.trackDataExported('user-456', 'tax_report', 'pdf');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'export_data',
        properties: {
          export_type: 'tax_report',
          format: 'pdf',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackDataExported('user-123', 'accounts', 'csv')).resolves.not.toThrow();
    });
  });

  describe('trackAssetAllocationViewed', () => {
    it('should track asset allocation view', async () => {
      await service.trackAssetAllocationViewed('user-123', {
        cash: 25,
        investments: 50,
        crypto: 15,
        other: 10,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'asset_allocation_viewed',
        properties: {
          cash_percentage: 25,
          investments_percentage: 50,
          crypto_percentage: 15,
          other_percentage: 10,
        },
      });
    });

    it('should track conservative allocation', async () => {
      await service.trackAssetAllocationViewed('user-456', {
        cash: 60,
        investments: 35,
        crypto: 0,
        other: 5,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'asset_allocation_viewed',
        properties: {
          cash_percentage: 60,
          investments_percentage: 35,
          crypto_percentage: 0,
          other_percentage: 5,
        },
      });
    });

    it('should track aggressive allocation', async () => {
      await service.trackAssetAllocationViewed('user-789', {
        cash: 10,
        investments: 60,
        crypto: 25,
        other: 5,
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'asset_allocation_viewed',
        properties: {
          cash_percentage: 10,
          investments_percentage: 60,
          crypto_percentage: 25,
          other_percentage: 5,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackAssetAllocationViewed('user-123', {
          cash: 30,
          investments: 40,
          crypto: 20,
          other: 10,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackWealthTrendsViewed', () => {
    it('should track weekly trends view', async () => {
      await service.trackWealthTrendsViewed('user-123', 'week');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'wealth_trends_viewed',
        properties: {
          period: 'week',
        },
      });
    });

    it('should track different trend periods', async () => {
      const periods: Array<'week' | 'month' | 'quarter' | 'year' | 'all'> = [
        'month',
        'quarter',
        'year',
        'all',
      ];

      for (const period of periods) {
        jest.clearAllMocks();
        await service.trackWealthTrendsViewed('user-456', period);

        expect(posthogService.capture).toHaveBeenCalledWith({
          distinctId: 'user-456',
          event: 'wealth_trends_viewed',
          properties: {
            period,
          },
        });
      }
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackWealthTrendsViewed('user-123', 'year')).resolves.not.toThrow();
    });
  });

  describe('trackESGScoresViewed', () => {
    it('should track ESG scores view with average', async () => {
      await service.trackESGScoresViewed('user-123', 10, 7.5);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'esg_scores_viewed',
        properties: {
          asset_count: 10,
          average_esg_score: 7.5,
        },
      });
    });

    it('should track ESG scores view without average', async () => {
      await service.trackESGScoresViewed('user-456', 3);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'esg_scores_viewed',
        properties: {
          asset_count: 3,
          average_esg_score: undefined,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackESGScoresViewed('user-123', 15, 8.2)).resolves.not.toThrow();
    });
  });

  describe('trackPortfolioAnalysisViewed', () => {
    it('should track performance analysis view', async () => {
      await service.trackPortfolioAnalysisViewed('user-123', 'performance');

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'portfolio_analysis_viewed',
        properties: {
          analysis_type: 'performance',
        },
      });
    });

    it('should track different analysis types', async () => {
      const types: Array<'performance' | 'allocation' | 'risk' | 'esg'> = [
        'allocation',
        'risk',
        'esg',
      ];

      for (const type of types) {
        jest.clearAllMocks();
        await service.trackPortfolioAnalysisViewed('user-456', type);

        expect(posthogService.capture).toHaveBeenCalledWith({
          distinctId: 'user-456',
          event: 'portfolio_analysis_viewed',
          properties: {
            analysis_type: type,
          },
        });
      }
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackPortfolioAnalysisViewed('user-123', 'risk')).resolves.not.toThrow();
    });
  });

  describe('trackMonteCarloSimulation', () => {
    it('should track retirement simulation with success probability', async () => {
      await service.trackMonteCarloSimulation('user-123', 'retirement', 10000, 30, 0.85);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'monte_carlo_simulation',
        properties: {
          simulation_type: 'retirement',
          iterations: 10000,
          years_projected: 30,
          probability_of_success: 0.85,
        },
      });
    });

    it('should track goal simulation without probability', async () => {
      await service.trackMonteCarloSimulation('user-456', 'goal', 5000, 10);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'monte_carlo_simulation',
        properties: {
          simulation_type: 'goal',
          iterations: 5000,
          years_projected: 10,
          probability_of_success: undefined,
        },
      });
    });

    it('should track general simulation', async () => {
      await service.trackMonteCarloSimulation('user-789', 'general', 20000, 15, 0.72);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'monte_carlo_simulation',
        properties: {
          simulation_type: 'general',
          iterations: 20000,
          years_projected: 15,
          probability_of_success: 0.72,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackMonteCarloSimulation('user-123', 'retirement', 10000, 25, 0.9)
      ).resolves.not.toThrow();
    });
  });

  describe('trackGoalProgressViewed', () => {
    it('should track goal progress with percentage calculation', async () => {
      await service.trackGoalProgressViewed('user-123', 'goal-456', 75000, 100000);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'goal_progress_viewed',
        properties: {
          goal_id: 'goal-456',
          current_progress: 75000,
          target_amount: 100000,
          progress_percentage: 75,
        },
      });
    });

    it('should calculate progress percentage correctly', async () => {
      await service.trackGoalProgressViewed('user-789', 'goal-123', 33333, 100000);

      const captureCall = posthogService.capture.mock.calls[0][0];
      expect(captureCall.properties.progress_percentage).toBeCloseTo(33.333, 2);
    });

    it('should handle over 100% progress', async () => {
      await service.trackGoalProgressViewed('user-456', 'goal-789', 120000, 100000);

      const captureCall = posthogService.capture.mock.calls[0][0];
      expect(captureCall.properties.progress_percentage).toBe(120);
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackGoalProgressViewed('user-123', 'goal-456', 50000, 100000)
      ).resolves.not.toThrow();
    });
  });

  describe('trackGoalCreated', () => {
    it('should track goal creation', async () => {
      const targetDate = new Date('2025-12-31');

      await service.trackGoalCreated('user-123', {
        type: 'retirement',
        targetAmount: 1000000,
        targetDate,
        currency: 'USD',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'goal_created',
        properties: {
          goal_type: 'retirement',
          target_amount: 1000000,
          target_date: '2025-12-31T00:00:00.000Z',
          currency: 'USD',
        },
      });
    });

    it('should track different goal types', async () => {
      const targetDate = new Date('2024-06-30');

      await service.trackGoalCreated('user-456', {
        type: 'house',
        targetAmount: 250000,
        targetDate,
        currency: 'EUR',
      });

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'goal_created',
        properties: {
          goal_type: 'house',
          target_amount: 250000,
          target_date: '2024-06-30T00:00:00.000Z',
          currency: 'EUR',
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(
        service.trackGoalCreated('user-123', {
          type: 'vacation',
          targetAmount: 10000,
          targetDate: new Date('2024-12-01'),
          currency: 'MXN',
        })
      ).resolves.not.toThrow();
    });
  });

  describe('trackCashflowForecastViewed', () => {
    it('should track 60-day cashflow forecast', async () => {
      await service.trackCashflowForecastViewed('user-123', 60, 0.85);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'cashflow_forecast_viewed',
        properties: {
          forecast_days: 60,
          confidence_level: 0.85,
        },
      });
    });

    it('should track different forecast periods', async () => {
      await service.trackCashflowForecastViewed('user-456', 90, 0.75);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'cashflow_forecast_viewed',
        properties: {
          forecast_days: 90,
          confidence_level: 0.75,
        },
      });
    });

    it('should track short-term forecast', async () => {
      await service.trackCashflowForecastViewed('user-789', 30, 0.95);

      expect(posthogService.capture).toHaveBeenCalledWith({
        distinctId: 'user-789',
        event: 'cashflow_forecast_viewed',
        properties: {
          forecast_days: 30,
          confidence_level: 0.95,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      posthogService.capture.mockRejectedValue(new Error('PostHog error'));

      await expect(service.trackCashflowForecastViewed('user-123', 60, 0.8)).resolves.not.toThrow();
    });
  });
});
