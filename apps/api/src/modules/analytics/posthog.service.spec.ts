import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PostHog } from 'posthog-node';

import { PostHogService } from './posthog.service';

// Mock PostHog
jest.mock('posthog-node');

describe('PostHogService', () => {
  let service: PostHogService;
  let configService: jest.Mocked<ConfigService>;
  let mockPostHogClient: jest.Mocked<PostHog>;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockPostHogClient = {
      capture: jest.fn(),
      identify: jest.fn(),
      groupIdentify: jest.fn(),
      flush: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
    } as any;

    (PostHog as jest.MockedClass<typeof PostHog>).mockImplementation(() => mockPostHogClient);
  });

  describe('initialization', () => {
    it('should initialize PostHog when API key is configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'POSTHOG_API_KEY') return 'test-api-key';
        if (key === 'POSTHOG_HOST') return 'https://test.posthog.com';
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(PostHog).toHaveBeenCalledWith('test-api-key', {
        host: 'https://test.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      });
      expect(service.isAnalyticsEnabled()).toBe(true);
    });

    it('should use default host when not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'POSTHOG_API_KEY') return 'test-api-key';
        return undefined;
      });

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(PostHog).toHaveBeenCalledWith('test-api-key', {
        host: 'https://analytics.madfam.io',
        flushAt: 20,
        flushInterval: 10000,
      });
    });

    it('should not initialize PostHog when API key is missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(PostHog).not.toHaveBeenCalled();
      expect(service.isAnalyticsEnabled()).toBe(false);
    });

    it('should handle PostHog initialization errors gracefully', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      (PostHog as jest.MockedClass<typeof PostHog>).mockImplementation(() => {
        throw new Error('PostHog initialization failed');
      });

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(service.isAnalyticsEnabled()).toBe(false);
    });
  });

  describe('onModuleDestroy', () => {
    it('should shutdown PostHog client on module destroy', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockPostHogClient.shutdown).toHaveBeenCalled();
    });

    it('should handle destroy when client is not initialized', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('capture', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should capture an event with properties', async () => {
      const event = {
        distinctId: 'user-123',
        event: 'test_event',
        properties: {
          foo: 'bar',
          count: 42,
        },
      };

      await service.capture(event);

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: 'test_event',
        properties: {
          foo: 'bar',
          count: 42,
          $lib: 'dhanam-api',
          $lib_version: '0.1.0',
          timestamp: expect.any(String),
        },
      });
    });

    it('should capture an event without properties', async () => {
      const event = {
        distinctId: 'user-456',
        event: 'simple_event',
      };

      await service.capture(event);

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user-456',
        event: 'simple_event',
        properties: {
          $lib: 'dhanam-api',
          $lib_version: '0.1.0',
          timestamp: expect.any(String),
        },
      });
    });

    it('should not capture when PostHog is disabled', async () => {
      // Reinitialize without API key
      mockConfigService.get.mockReturnValue(undefined);
      const disabledModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const disabledService = disabledModule.get<PostHogService>(PostHogService);
      disabledService['logger'] = {
        debug: jest.fn(),
        warn: jest.fn(),
      } as any;
      await disabledService.onModuleInit();

      await disabledService.capture({
        distinctId: 'user-123',
        event: 'test_event',
      });

      expect(mockPostHogClient.capture).not.toHaveBeenCalled();
    });

    it('should handle capture errors gracefully', async () => {
      mockPostHogClient.capture.mockImplementation(() => {
        throw new Error('Capture failed');
      });

      await expect(
        service.capture({
          distinctId: 'user-123',
          event: 'test_event',
        })
      ).resolves.not.toThrow();
    });

    it('should include timestamp in captured events', async () => {
      const beforeTime = new Date().toISOString();

      await service.capture({
        distinctId: 'user-123',
        event: 'test_event',
      });

      const afterTime = new Date().toISOString();
      const capturedProperties = mockPostHogClient.capture.mock.calls[0][0].properties;

      expect(capturedProperties.timestamp).toBeDefined();
      expect(capturedProperties.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(capturedProperties.timestamp >= beforeTime).toBe(true);
      expect(capturedProperties.timestamp <= afterTime).toBe(true);
    });
  });

  describe('identify', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should identify a user with properties', async () => {
      const event = {
        distinctId: 'user-123',
        properties: {
          email: 'user@example.com',
          name: 'Test User',
          plan: 'premium',
        },
      };

      await service.identify(event);

      expect(mockPostHogClient.identify).toHaveBeenCalledWith({
        distinctId: 'user-123',
        properties: {
          email: 'user@example.com',
          name: 'Test User',
          plan: 'premium',
        },
      });
    });

    it('should not identify when PostHog is disabled', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const disabledModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const disabledService = disabledModule.get<PostHogService>(PostHogService);
      await disabledService.onModuleInit();

      await disabledService.identify({
        distinctId: 'user-123',
        properties: { email: 'test@example.com' },
      });

      expect(mockPostHogClient.identify).not.toHaveBeenCalled();
    });

    it('should handle identify errors gracefully', async () => {
      mockPostHogClient.identify.mockImplementation(() => {
        throw new Error('Identify failed');
      });

      await expect(
        service.identify({
          distinctId: 'user-123',
          properties: { email: 'test@example.com' },
        })
      ).resolves.not.toThrow();
    });
  });

  describe('setPersonProperties', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should set person properties with $set', async () => {
      await service.setPersonProperties('user-123', {
        email: 'new@example.com',
        name: 'Updated Name',
      });

      expect(mockPostHogClient.identify).toHaveBeenCalledWith({
        distinctId: 'user-123',
        properties: {
          email: 'new@example.com',
          name: 'Updated Name',
          $set: {
            email: 'new@example.com',
            name: 'Updated Name',
          },
        },
      });
    });
  });

  describe('setPersonPropertiesOnce', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should set person properties with $set_once', async () => {
      await service.setPersonPropertiesOnce('user-123', {
        signup_date: '2023-01-01',
        first_login: '2023-01-01',
      });

      expect(mockPostHogClient.identify).toHaveBeenCalledWith({
        distinctId: 'user-123',
        properties: {
          $set_once: {
            signup_date: '2023-01-01',
            first_login: '2023-01-01',
          },
        },
      });
    });
  });

  describe('group', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should identify a group with properties', async () => {
      await service.group('user-123', 'company', 'company-456', {
        name: 'Acme Corp',
        plan: 'enterprise',
        employees: 100,
      });

      expect(mockPostHogClient.groupIdentify).toHaveBeenCalledWith({
        groupType: 'company',
        groupKey: 'company-456',
        properties: {
          name: 'Acme Corp',
          plan: 'enterprise',
          employees: 100,
        },
      });
    });

    it('should identify a group without properties', async () => {
      await service.group('user-123', 'team', 'team-789');

      expect(mockPostHogClient.groupIdentify).toHaveBeenCalledWith({
        groupType: 'team',
        groupKey: 'team-789',
        properties: {},
      });
    });

    it('should not group when PostHog is disabled', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const disabledModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const disabledService = disabledModule.get<PostHogService>(PostHogService);
      await disabledService.onModuleInit();

      await disabledService.group('user-123', 'company', 'company-456');

      expect(mockPostHogClient.groupIdentify).not.toHaveBeenCalled();
    });

    it('should handle group errors gracefully', async () => {
      mockPostHogClient.groupIdentify.mockImplementation(() => {
        throw new Error('Group failed');
      });

      await expect(service.group('user-123', 'company', 'company-456')).resolves.not.toThrow();
    });
  });

  describe('captureFeatureFlagCalled', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should capture feature flag evaluation', async () => {
      await service.captureFeatureFlagCalled('user-123', 'new-dashboard', true);

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: '$feature_flag_called',
        properties: {
          $feature_flag: 'new-dashboard',
          $feature_flag_response: true,
          $lib: 'dhanam-api',
          $lib_version: '0.1.0',
          timestamp: expect.any(String),
        },
      });
    });

    it('should capture feature flag with complex value', async () => {
      await service.captureFeatureFlagCalled('user-123', 'experiment', {
        variant: 'control',
        value: 42,
      });

      expect(mockPostHogClient.capture).toHaveBeenCalledWith({
        distinctId: 'user-123',
        event: '$feature_flag_called',
        properties: {
          $feature_flag: 'experiment',
          $feature_flag_response: {
            variant: 'control',
            value: 42,
          },
          $lib: 'dhanam-api',
          $lib_version: '0.1.0',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();
    });

    it('should flush pending events', async () => {
      await service.flush();

      expect(mockPostHogClient.flush).toHaveBeenCalled();
    });

    it('should not throw when client is not initialized', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      const disabledModule = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();
      const disabledService = disabledModule.get<PostHogService>(PostHogService);
      await disabledService.onModuleInit();

      await expect(disabledService.flush()).resolves.not.toThrow();
    });
  });

  describe('isAnalyticsEnabled', () => {
    it('should return true when PostHog is initialized', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(service.isAnalyticsEnabled()).toBe(true);
    });

    it('should return false when API key is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(service.isAnalyticsEnabled()).toBe(false);
    });

    it('should return false when initialization failed', async () => {
      mockConfigService.get.mockReturnValue('test-api-key');
      (PostHog as jest.MockedClass<typeof PostHog>).mockImplementation(() => {
        throw new Error('Initialization failed');
      });

      const module = await Test.createTestingModule({
        providers: [PostHogService, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      service = module.get<PostHogService>(PostHogService);
      service['logger'] = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      await service.onModuleInit();

      expect(service.isAnalyticsEnabled()).toBe(false);
    });
  });
});
