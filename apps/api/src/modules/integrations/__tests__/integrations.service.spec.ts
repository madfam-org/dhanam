import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import Belvo from 'belvo';
import { PlaidApi } from 'plaid';

import { IntegrationsService } from '../integrations.service';

// Mock external dependencies
jest.mock('axios');
jest.mock('belvo');
jest.mock('plaid');

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return status for all integrations', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          NODE_ENV: 'development',
          BELVO_ENV: 'sandbox',
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          PLAID_ENV: 'sandbox',
          PLAID_CLIENT_ID: 'test-client-id',
          PLAID_SECRET: 'test-secret',
          BITSO_API_KEY: 'test-api-key',
          BITSO_API_SECRET: 'test-api-secret',
        };
        return config[key] ?? defaultValue;
      });

      const result = await service.getStatus();

      expect(result.integrations).toHaveLength(3);
      expect(result.integrations[0].name).toBe('Belvo');
      expect(result.integrations[0].enabled).toBe(true);
      expect(result.integrations[0].configured).toBe(true);
      expect(result.integrations[0].environment).toBe('sandbox');

      expect(result.integrations[1].name).toBe('Plaid');
      expect(result.integrations[1].enabled).toBe(true);
      expect(result.integrations[1].configured).toBe(true);

      expect(result.integrations[2].name).toBe('Bitso');
      expect(result.integrations[2].enabled).toBe(true);
      expect(result.integrations[2].configured).toBe(true);

      expect(result.summary.total).toBe(3);
      expect(result.summary.enabled).toBe(3);
      expect(result.summary.configured).toBe(3);
    });

    it('should show unconfigured integrations', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          NODE_ENV: 'development',
          BELVO_ENV: 'sandbox',
          PLAID_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      const result = await service.getStatus();

      expect(result.integrations[0].configured).toBe(false);
      expect(result.integrations[1].configured).toBe(false);
      expect(result.integrations[2].configured).toBe(false);
      expect(result.summary.configured).toBe(0);
    });

    it('should disable integrations in production if not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          NODE_ENV: 'production',
          BELVO_ENV: 'production',
          PLAID_ENV: 'production',
        };
        return config[key] ?? defaultValue;
      });

      const result = await service.getStatus();

      expect(result.integrations[0].enabled).toBe(false);
      expect(result.integrations[1].enabled).toBe(false);
      expect(result.integrations[2].enabled).toBe(false);
      expect(result.summary.enabled).toBe(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all integrations are healthy', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          BELVO_ENV: 'sandbox',
          PLAID_CLIENT_ID: 'test-client-id',
          PLAID_SECRET: 'test-secret',
          PLAID_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      // Mock Belvo health check
      const mockBelvoClient = {
        institutions: {
          list: jest.fn().mockResolvedValue([]),
        },
      };
      (Belvo as jest.MockedClass<typeof Belvo>).mockImplementation(() => mockBelvoClient as any);

      // Mock Plaid health check
      const mockPlaidClient = {
        categoriesGet: jest.fn().mockResolvedValue({}),
      };
      (PlaidApi as jest.MockedClass<typeof PlaidApi>).mockImplementation(
        () => mockPlaidClient as any
      );

      // Mock Bitso health check
      (axios.get as jest.Mock).mockResolvedValue({ data: {} });

      const result = await service.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.integrations).toHaveLength(3);
      expect(result.integrations[0].status).toBe('healthy');
      expect(result.integrations[0].latency).toBeGreaterThanOrEqual(0);
      expect(result.integrations[1].status).toBe('healthy');
      expect(result.integrations[2].status).toBe('healthy');
    });

    it('should return degraded status when some integrations fail', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          BELVO_ENV: 'sandbox',
          PLAID_CLIENT_ID: 'test-client-id',
          PLAID_SECRET: 'test-secret',
          PLAID_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      // Mock Belvo to fail
      const mockBelvoClient = {
        institutions: {
          list: jest.fn().mockRejectedValue(new Error('Connection failed')),
        },
      };
      (Belvo as jest.MockedClass<typeof Belvo>).mockImplementation(() => mockBelvoClient as any);

      // Mock Plaid to succeed
      const mockPlaidClient = {
        categoriesGet: jest.fn().mockResolvedValue({}),
      };
      (PlaidApi as jest.MockedClass<typeof PlaidApi>).mockImplementation(
        () => mockPlaidClient as any
      );

      // Mock Bitso to succeed
      (axios.get as jest.Mock).mockResolvedValue({ data: {} });

      const result = await service.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.integrations[0].status).toBe('unhealthy');
      expect(result.integrations[0].error).toContain('Connection failed');
      expect(result.integrations[1].status).toBe('healthy');
      expect(result.integrations[2].status).toBe('healthy');
    });

    it('should return degraded status when Belvo and Plaid are not configured', async () => {
      configService.get.mockImplementation((key: string) => {
        // Return undefined for all config keys to simulate not configured
        return undefined;
      });

      // Bitso public endpoint still works
      (axios.get as jest.Mock).mockResolvedValue({ data: {} });

      const result = await service.getHealthStatus();

      // Status is degraded because Bitso (public endpoint) is healthy but Belvo/Plaid fail
      expect(result.status).toBe('degraded');
      expect(result.integrations[0].status).toBe('unhealthy');
      expect(result.integrations[0].error).toContain('not configured');
      expect(result.integrations[1].status).toBe('unhealthy');
      expect(result.integrations[1].error).toContain('not configured');
      expect(result.integrations[2].status).toBe('healthy'); // Public endpoint succeeds
    });

    it('should handle Belvo API errors gracefully', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          BELVO_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      const mockBelvoClient = {
        institutions: {
          list: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
        },
      };
      (Belvo as jest.MockedClass<typeof Belvo>).mockImplementation(() => mockBelvoClient as any);

      // Mock Plaid and Bitso to succeed
      const mockPlaidClient = {
        categoriesGet: jest.fn().mockResolvedValue({}),
      };
      (PlaidApi as jest.MockedClass<typeof PlaidApi>).mockImplementation(
        () => mockPlaidClient as any
      );
      (axios.get as jest.Mock).mockResolvedValue({ data: {} });

      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          BELVO_ENV: 'sandbox',
          PLAID_CLIENT_ID: 'test-client-id',
          PLAID_SECRET: 'test-secret',
          PLAID_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      const result = await service.getHealthStatus();

      expect(result.integrations[0].status).toBe('unhealthy');
      expect(result.integrations[0].error).toContain('API rate limit exceeded');
    });

    it('should handle Plaid API errors gracefully', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          BELVO_ENV: 'sandbox',
          PLAID_CLIENT_ID: 'test-client-id',
          PLAID_SECRET: 'test-secret',
          PLAID_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      const mockBelvoClient = {
        institutions: {
          list: jest.fn().mockResolvedValue([]),
        },
      };
      (Belvo as jest.MockedClass<typeof Belvo>).mockImplementation(() => mockBelvoClient as any);

      const mockPlaidClient = {
        categoriesGet: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
      };
      (PlaidApi as jest.MockedClass<typeof PlaidApi>).mockImplementation(
        () => mockPlaidClient as any
      );

      (axios.get as jest.Mock).mockResolvedValue({ data: {} });

      const result = await service.getHealthStatus();

      expect(result.integrations[1].status).toBe('unhealthy');
      expect(result.integrations[1].error).toContain('Invalid credentials');
    });

    it('should handle Bitso API timeout', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          BELVO_SECRET_KEY_ID: 'test-key',
          BELVO_SECRET_KEY_PASSWORD: 'test-password',
          BELVO_ENV: 'sandbox',
          PLAID_CLIENT_ID: 'test-client-id',
          PLAID_SECRET: 'test-secret',
          PLAID_ENV: 'sandbox',
        };
        return config[key] ?? defaultValue;
      });

      const mockBelvoClient = {
        institutions: {
          list: jest.fn().mockResolvedValue([]),
        },
      };
      (Belvo as jest.MockedClass<typeof Belvo>).mockImplementation(() => mockBelvoClient as any);

      const mockPlaidClient = {
        categoriesGet: jest.fn().mockResolvedValue({}),
      };
      (PlaidApi as jest.MockedClass<typeof PlaidApi>).mockImplementation(
        () => mockPlaidClient as any
      );

      (axios.get as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      const result = await service.getHealthStatus();

      expect(result.integrations[2].status).toBe('unhealthy');
      expect(result.integrations[2].error).toContain('Request timeout');
    });
  });
});
