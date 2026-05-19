import { Test, TestingModule } from '@nestjs/testing';
import { PostHog } from 'posthog-node';

import { LoggerService } from '@core/logger/logger.service';

import { PostHogService } from '../posthog.service';

jest.mock('posthog-node');

describe('PostHogService', () => {
  let service: PostHogService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockPostHogClient: jest.Mocked<PostHog>;

  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.POSTHOG_API_KEY = 'test-api-key';
    process.env.POSTHOG_HOST = 'https://test.posthog.com';

    mockPostHogClient = {
      capture: jest.fn(),
      identify: jest.fn(),
      alias: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as any;

    (PostHog as jest.MockedClass<typeof PostHog>).mockImplementation(() => mockPostHogClient);

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
    }).compile();

    service = module.get<PostHogService>(PostHogService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize PostHog client with API key', () => {
      expect(PostHog).toHaveBeenCalledWith(
        'test-api-key',
        expect.objectContaining({
          host: 'https://test.posthog.com',
          flushAt: 20,
          flushInterval: 10000,
        })
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'PostHog analytics initialized',
        'PostHogService'
      );
    });

    it('should disable analytics when API key is missing', async () => {
      process.env.POSTHOG_API_KEY = '';

      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      const serviceWithoutKey = moduleWithoutKey.get<PostHogService>(PostHogService);

      // Try to capture an event - should not throw
      await serviceWithoutKey.capture('user-123', 'test_event', { data: 'test' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PostHog API key not configured. Analytics disabled.',
        'PostHogService'
      );
    });

    it('should use default PostHog host when not configured', async () => {
      delete process.env.POSTHOG_HOST;
      process.env.POSTHOG_API_KEY = 'test-key';

      const moduleDefaultHost: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      moduleDefaultHost.get<PostHogService>(PostHogService);

      expect(PostHog).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://analytics.madfam.io',
        })
      );
    });
  });

  describe('capture', () => {
    it('should capture event with properties', async () => {
      await service.capture('user-123', 'test_event', { prop1: 'value1' });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'test_event',
        properties: expect.objectContaining({
          prop1: 'value1',
          timestamp: expect.any(String),
        }),
      });
    });

    it('should log event capture', async () => {
      await service.capture('user-123', 'test_event');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Event captured: test_event for user: user-123',
        'PostHogService'
      );
    });

    it('should handle capture errors gracefully', async () => {
      mockPostHogClient.capture.mockImplementation(() => {
        throw new Error('Capture failed');
      });

      await expect(service.capture('user-123', 'test_event')).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to capture event',
        'Capture failed',
        'PostHogService'
      );
    });

    it('should not capture when disabled', async () => {
      process.env.POSTHOG_API_KEY = '';

      const moduleDisabled: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      const disabledService = moduleDisabled.get<PostHogService>(PostHogService);
      await disabledService.capture('user-123', 'test_event');

      expect(mockPostHogClient.capture).not.toHaveBeenCalled();
    });
  });

  describe('identify', () => {
    it('should identify user with properties', async () => {
      const properties = {
        email: 'test@example.com',
        name: 'Test User',
        locale: 'es',
        timezone: 'America/Mexico_City',
      };

      await service.identify('user-123', properties);

      expect(mockPostHogClient.identify).toHaveBeenCalledWith({
        distinctId: 'user-123',
        properties,
      });
    });

    it('should log user identification', async () => {
      await service.identify('user-123', { email: 'test@example.com' });

      expect(mockLogger.log).toHaveBeenCalledWith('User identified: user-123', 'PostHogService');
    });

    it('should handle identify errors gracefully', async () => {
      mockPostHogClient.identify.mockImplementation(() => {
        throw new Error('Identify failed');
      });

      await expect(
        service.identify('user-123', { email: 'test@example.com' })
      ).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to identify user',
        'Identify failed',
        'PostHogService'
      );
    });

    it('should not identify when disabled', async () => {
      process.env.POSTHOG_API_KEY = '';

      const moduleDisabled: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      const disabledService = moduleDisabled.get<PostHogService>(PostHogService);
      await disabledService.identify('user-123', { email: 'test@example.com' });

      expect(mockPostHogClient.identify).not.toHaveBeenCalled();
    });
  });

  describe('Domain-specific trackers', () => {
    it('should track sign_up event', async () => {
      await service.trackSignUp('user-123', {
        email: 'test@example.com',
        name: 'Test User',
        locale: 'es',
        registrationMethod: 'email',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'user-123',
          event: 'sign_up',
          properties: expect.objectContaining({
            email: 'test@example.com',
            registrationMethod: 'email',
          }),
        })
      );
    });

    it('should track onboarding_complete event', async () => {
      await service.trackOnboardingComplete('user-123', {
        stepsCompleted: 5,
        timeToComplete: 120000,
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'onboarding_complete',
          properties: expect.objectContaining({
            stepsCompleted: 5,
            timeToComplete: 120000,
          }),
        })
      );
    });

    it('should track connect_initiated event', async () => {
      await service.trackConnectInitiated('user-123', {
        provider: 'belvo',
        spaceId: 'space-123',
        spaceType: 'personal',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'connect_initiated',
          properties: expect.objectContaining({
            provider: 'belvo',
            spaceId: 'space-123',
          }),
        })
      );
    });

    it('should track connect_success event', async () => {
      await service.trackConnectSuccess('user-123', {
        provider: 'plaid',
        accountsLinked: 3,
        spaceId: 'space-123',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'connect_success',
          properties: expect.objectContaining({
            provider: 'plaid',
            accountsLinked: 3,
          }),
        })
      );
    });

    it('should track sync_success event', async () => {
      await service.trackSyncSuccess('user-123', {
        provider: 'bitso',
        accountId: 'account-123',
        transactionsAdded: 50,
        syncDuration: 5000,
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'sync_success',
          properties: expect.objectContaining({
            transactionsAdded: 50,
            syncDuration: 5000,
          }),
        })
      );
    });

    it('should track budget_created event', async () => {
      await service.trackBudgetCreated('user-123', {
        budgetId: 'budget-123',
        spaceId: 'space-123',
        period: 'monthly',
        categoriesCount: 10,
        totalAmount: 50000,
        currency: 'MXN',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'budget_created',
          properties: expect.objectContaining({
            period: 'monthly',
            totalAmount: 50000,
            currency: 'MXN',
          }),
        })
      );
    });

    it('should track rule_created event', async () => {
      await service.trackRuleCreated('user-123', {
        ruleId: 'rule-123',
        spaceId: 'space-123',
        matchType: 'contains',
        categoryId: 'category-123',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'rule_created',
          properties: expect.objectContaining({
            matchType: 'contains',
          }),
        })
      );
    });

    it('should track txn_categorized event', async () => {
      await service.trackTransactionCategorized('user-123', {
        transactionId: 'txn-123',
        categoryId: 'category-123',
        isAutomatic: true,
        spaceId: 'space-123',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'txn_categorized',
          properties: expect.objectContaining({
            isAutomatic: true,
          }),
        })
      );
    });

    it('should track alert_fired event', async () => {
      await service.trackAlertFired('user-123', {
        budgetId: 'budget-123',
        categoryId: 'category-123',
        spaceId: 'space-123',
        percentageUsed: 95,
        alertType: 'warning',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'alert_fired',
          properties: expect.objectContaining({
            percentageUsed: 95,
            alertType: 'warning',
          }),
        })
      );
    });

    it('should track view_net_worth event', async () => {
      await service.trackViewNetWorth('user-123', {
        spaceId: 'space-123',
        totalNetWorth: 1000000,
        currency: 'MXN',
        accountsCount: 5,
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'view_net_worth',
          properties: expect.objectContaining({
            totalNetWorth: 1000000,
            accountsCount: 5,
          }),
        })
      );
    });

    it('should track export_data event', async () => {
      await service.trackExportData('user-123', {
        exportType: 'csv',
        dataType: 'transactions',
        recordsExported: 100,
        spaceId: 'space-123',
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'export_data',
          properties: expect.objectContaining({
            exportType: 'csv',
            dataType: 'transactions',
            recordsExported: 100,
          }),
        })
      );
    });
  });

  describe('alias', () => {
    it('should create alias for user', async () => {
      await service.alias('user-123', 'alias-456');

      expect(mockPostHogClient.alias).toHaveBeenCalledWith({
        distinctId: 'user-123',
        alias: 'alias-456',
      });
    });

    it('should log alias creation', async () => {
      await service.alias('user-123', 'alias-456');

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alias created: alias-456 for user: user-123',
        'PostHogService'
      );
    });

    it('should handle alias errors gracefully', async () => {
      mockPostHogClient.alias.mockImplementation(() => {
        throw new Error('Alias failed');
      });

      await expect(service.alias('user-123', 'alias-456')).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create alias',
        'Alias failed',
        'PostHogService'
      );
    });

    it('should not create alias when disabled', async () => {
      process.env.POSTHOG_API_KEY = '';

      const moduleDisabled: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      const disabledService = moduleDisabled.get<PostHogService>(PostHogService);
      await disabledService.alias('user-123', 'alias-456');

      expect(mockPostHogClient.alias).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should flush pending events', async () => {
      await service.flush();

      expect(mockPostHogClient.flush).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('PostHog events flushed', 'PostHogService');
    });

    it('should handle flush errors gracefully', async () => {
      mockPostHogClient.flush.mockRejectedValue(new Error('Flush failed'));

      await expect(service.flush()).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to flush events',
        'Flush failed',
        'PostHogService'
      );
    });

    it('should not flush when disabled', async () => {
      process.env.POSTHOG_API_KEY = '';

      const moduleDisabled: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      const disabledService = moduleDisabled.get<PostHogService>(PostHogService);
      await disabledService.flush();

      expect(mockPostHogClient.flush).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should shutdown PostHog client', async () => {
      await service.onModuleDestroy();

      expect(mockPostHogClient.shutdown).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('PostHog client shut down', 'PostHogService');
    });

    it('should handle shutdown errors gracefully', async () => {
      mockPostHogClient.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to shut down PostHog client',
        'Shutdown failed',
        'PostHogService'
      );
    });

    it('should not shutdown when disabled', async () => {
      process.env.POSTHOG_API_KEY = '';

      const moduleDisabled: TestingModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: LoggerService, useValue: mockLogger }],
      }).compile();

      const disabledService = moduleDisabled.get<PostHogService>(PostHogService);
      await disabledService.onModuleDestroy();

      expect(mockPostHogClient.shutdown).not.toHaveBeenCalled();
    });
  });
});
