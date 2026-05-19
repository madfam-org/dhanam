import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EventsService } from '../../../core/events/events.service';
import { ProviderException } from '../../../core/exceptions/domain-exceptions';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProviderSelectionService } from '../../ml/provider-selection.service';

import { CircuitBreakerService } from './circuit-breaker.service';
import { ProviderOrchestratorService } from './provider-orchestrator.service';
import { IFinancialProvider } from './provider.interface';

describe('ProviderOrchestratorService', () => {
  let service: ProviderOrchestratorService;
  let prismaService: jest.Mocked<PrismaService>;
  let circuitBreaker: jest.Mocked<CircuitBreakerService>;
  let providerSelection: jest.Mocked<ProviderSelectionService>;

  const mockPrisma = {
    institutionProviderMapping: {
      findFirst: jest.fn(),
    },
    connectionAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    providerHealthStatus: {
      findMany: jest.fn(),
    },
  };

  const mockCircuitBreaker = {
    isCircuitOpen: jest.fn(),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    getState: jest.fn(),
    reset: jest.fn(),
  };

  const mockProviderSelection = {
    selectOptimalProvider: jest.fn(),
  };

  const mockEventsService = {
    emit: jest.fn(),
    subscribe: jest.fn(),
    getActiveConnectionCount: jest.fn().mockReturnValue(0),
  };

  // Mock provider implementation
  const mockProvider: IFinancialProvider = {
    name: 'plaid' as any,
    createLink: jest.fn(),
    exchangeToken: jest.fn(),
    getAccounts: jest.fn(),
    syncTransactions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderOrchestratorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreaker,
        },
        {
          provide: ProviderSelectionService,
          useValue: mockProviderSelection,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
      ],
    }).compile();

    service = module.get<ProviderOrchestratorService>(ProviderOrchestratorService);
    service['logger'] = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    prismaService = module.get(PrismaService);
    circuitBreaker = module.get(CircuitBreakerService);
    providerSelection = module.get(ProviderSelectionService);
  });

  describe('registerProvider', () => {
    it('should register a provider implementation', () => {
      service.registerProvider(mockProvider);

      expect(service['providers'].has('plaid' as any)).toBe(true);
      expect(service['providers'].get('plaid' as any)).toBe(mockProvider);
    });

    it('should overwrite existing provider registration', () => {
      const newProvider = { ...mockProvider, name: 'plaid' as any };

      service.registerProvider(mockProvider);
      service.registerProvider(newProvider);

      expect(service['providers'].get('plaid' as any)).toBe(newProvider);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return default provider for US when no mapping exists', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(null);

      const providers = await service.getAvailableProviders('inst-123', 'US');

      expect(providers).toEqual(['plaid' as any]);
    });

    it('should return default provider for MX when no mapping exists', async () => {
      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(null);

      const providers = await service.getAvailableProviders('inst-123', 'MX');

      expect(providers).toEqual(['belvo' as any]);
    });

    it('should return primary provider and filter by circuit breaker', async () => {
      const mockMapping = {
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: ['mx' as any, 'finicity' as any],
      };

      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(mockMapping);
      mockCircuitBreaker.isCircuitOpen
        .mockResolvedValueOnce(false) // plaid: closed
        .mockResolvedValueOnce(true) // mx: open
        .mockResolvedValueOnce(false); // finicity: closed

      const providers = await service.getAvailableProviders('inst-123', 'US');

      expect(providers).toEqual(['plaid' as any, 'finicity' as any]);
      expect(mockCircuitBreaker.isCircuitOpen).toHaveBeenCalledTimes(3);
    });

    it('should throw ProviderException when all circuit breakers are open', async () => {
      const mockMapping = {
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: ['mx' as any],
      };

      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(mockMapping);
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(true); // All open

      await expect(service.getAvailableProviders('inst-123', 'US')).rejects.toThrow(
        ProviderException
      );
    });

    it('should handle mapping without backup providers', async () => {
      const mockMapping = {
        institutionId: 'inst-123',
        region: 'US',
        primaryProvider: 'plaid' as any,
        backupProviders: null,
      };

      mockPrisma.institutionProviderMapping.findFirst.mockResolvedValue(mockMapping);
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      const providers = await service.getAvailableProviders('inst-123', 'US');

      expect(providers).toEqual(['plaid' as any]);
    });
  });

  describe('executeWithFailover', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider);
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);
      mockCircuitBreaker.recordSuccess.mockResolvedValue();
      mockCircuitBreaker.recordFailure.mockResolvedValue();
      mockPrisma.connectionAttempt.create.mockResolvedValue({} as any);
    });

    it('should succeed on first provider attempt', async () => {
      const mockResult = { linkToken: 'token-123' };
      (mockProvider.createLink as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1', institutionId: 'inst-1', userId: 'user-1' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(result.provider).toBe('plaid');
      expect(result.failoverUsed).toBe(false);
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalledWith(
        'plaid',
        'US',
        expect.any(Number)
      );
    });

    it('should use ML provider selection when no preferred provider', async () => {
      mockProviderSelection.selectOptimalProvider.mockResolvedValue('plaid' as any);
      (mockProvider.createLink as jest.Mock).mockResolvedValue({ linkToken: 'token' });

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1', institutionId: 'inst-1', userId: 'user-1' },
        undefined,
        'US'
      );

      expect(mockProviderSelection.selectOptimalProvider).toHaveBeenCalledWith(
        'inst-1',
        'US',
        'user-1'
      );
      expect(result.success).toBe(true);
    });

    it('should failover to backup provider on first failure', async () => {
      // Create providers with separate mock functions
      const mockPlaidProvider: IFinancialProvider = {
        name: 'plaid' as any,
        createLink: jest.fn().mockRejectedValue(new Error('Network timeout')),
        exchangeToken: jest.fn(),
        getAccounts: jest.fn(),
        syncTransactions: jest.fn(),
      };
      const mockMxProvider: IFinancialProvider = {
        name: 'mx' as any,
        createLink: jest.fn().mockResolvedValue({ linkToken: 'token' }),
        exchangeToken: jest.fn(),
        getAccounts: jest.fn(),
        syncTransactions: jest.fn(),
      };

      service.registerProvider(mockPlaidProvider);
      service.registerProvider(mockMxProvider);

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1', institutionId: 'inst-1' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('mx');
      expect(result.failoverUsed).toBe(true);
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledWith(
        'plaid',
        'US',
        expect.any(String),
        expect.any(Number)
      );
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalledWith('mx', 'US', expect.any(Number));
    });

    it('should return failure when all providers fail', async () => {
      (mockProvider.createLink as jest.Mock).mockRejectedValue(new Error('Auth failed'));

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1', institutionId: 'inst-1' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Auth failed');
    });

    it('should skip provider with open circuit breaker', async () => {
      // Create providers with separate mock functions
      const mockPlaidProvider: IFinancialProvider = {
        name: 'plaid' as any,
        createLink: jest.fn(),
        exchangeToken: jest.fn(),
        getAccounts: jest.fn(),
        syncTransactions: jest.fn(),
      };
      const mockMxProvider: IFinancialProvider = {
        name: 'mx' as any,
        createLink: jest.fn().mockResolvedValue({ linkToken: 'token' }),
        exchangeToken: jest.fn(),
        getAccounts: jest.fn(),
        syncTransactions: jest.fn(),
      };

      service.registerProvider(mockPlaidProvider);
      service.registerProvider(mockMxProvider);

      // Plaid circuit is open, mx is closed
      mockCircuitBreaker.isCircuitOpen
        .mockResolvedValueOnce(true) // plaid: open (main check)
        .mockResolvedValueOnce(false) // mx: closed (backup check)
        .mockResolvedValueOnce(false); // finicity: closed (backup check)

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('mx');
      expect(mockPlaidProvider.createLink).not.toHaveBeenCalled();
    });

    it('should execute exchangeToken operation', async () => {
      const mockResult = { accessToken: 'access-123', refreshToken: 'refresh-456' };
      (mockProvider.exchangeToken as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.executeWithFailover(
        'exchangeToken',
        { spaceId: 'space-1', publicToken: 'public-token' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(mockProvider.exchangeToken).toHaveBeenCalled();
    });

    it('should execute getAccounts operation', async () => {
      const mockResult = { accounts: [{ id: 'acc-1', name: 'Checking' }] };
      (mockProvider.getAccounts as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.executeWithFailover(
        'getAccounts',
        { spaceId: 'space-1', accessToken: 'token' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
    });

    it('should execute syncTransactions operation', async () => {
      const mockResult = { transactions: [], accounts: [] };
      (mockProvider.syncTransactions as jest.Mock).mockResolvedValue(mockResult);

      const result = await service.executeWithFailover(
        'syncTransactions',
        { spaceId: 'space-1', accountId: 'acc-1' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
    });

    it('should not retry on non-retryable auth errors', async () => {
      // Create providers with separate mock functions
      const mockPlaidProvider: IFinancialProvider = {
        name: 'plaid' as any,
        createLink: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
        exchangeToken: jest.fn(),
        getAccounts: jest.fn(),
        syncTransactions: jest.fn(),
      };
      const mockMxProvider: IFinancialProvider = {
        name: 'mx' as any,
        createLink: jest.fn().mockResolvedValue({ linkToken: 'token' }),
        exchangeToken: jest.fn(),
        getAccounts: jest.fn(),
        syncTransactions: jest.fn(),
      };

      service.registerProvider(mockPlaidProvider);
      service.registerProvider(mockMxProvider);

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1' },
        'plaid' as any,
        'US'
      );

      expect(result.success).toBe(false);
      expect(mockMxProvider.createLink).not.toHaveBeenCalled(); // Should not try backup for auth errors
    });

    it('should log connection attempts for both success and failure', async () => {
      (mockProvider.createLink as jest.Mock).mockResolvedValue({ linkToken: 'token' });

      await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1', accountId: 'acc-1', institutionId: 'inst-1' },
        'plaid' as any,
        'US'
      );

      expect(mockPrisma.connectionAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          spaceId: 'space-1',
          accountId: 'acc-1',
          provider: 'plaid',
          institutionId: 'inst-1',
          attemptType: 'createLink',
          status: 'success',
          responseTimeMs: expect.any(Number),
          failoverUsed: false,
        }),
      });
    });
  });

  describe('parseError', () => {
    it('should parse auth errors as non-retryable', () => {
      const error = new Error('Invalid auth credentials');
      const parsed = service['parseError'](error, 'plaid' as any);

      expect(parsed.type).toBe('auth');
      expect(parsed.retryable).toBe(false);
    });

    it('should parse rate limit errors as retryable', () => {
      const error = new Error('Rate limit exceeded');
      const parsed = service['parseError'](error, 'plaid' as any);

      expect(parsed.type).toBe('rate_limit');
      expect(parsed.retryable).toBe(true);
    });

    it('should parse network errors as retryable', () => {
      const error = new Error('Connection timeout');
      const parsed = service['parseError'](error, 'plaid' as any);

      expect(parsed.type).toBe('network');
      expect(parsed.retryable).toBe(true);
    });

    it('should parse provider down errors as retryable', () => {
      const error = new Error('Service unavailable');
      const parsed = service['parseError'](error, 'plaid' as any);

      expect(parsed.type).toBe('provider_down');
      expect(parsed.retryable).toBe(true);
    });

    it('should parse validation errors as non-retryable', () => {
      // Note: parseError is case-sensitive, "Invalid" doesn't match "invalid"
      // Use lowercase to match validation error pattern
      const error = new Error('invalid input data');
      const parsed = service['parseError'](error, 'plaid' as any);

      expect(parsed.type).toBe('validation');
      expect(parsed.retryable).toBe(false);
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something unexpected happened');
      const parsed = service['parseError'](error, 'plaid' as any);

      expect(parsed.type).toBe('unknown');
      expect(parsed.retryable).toBe(false);
    });
  });

  describe('getBackupProviders', () => {
    beforeEach(() => {
      service.registerProvider({ ...mockProvider, name: 'plaid' as any });
      service.registerProvider({ ...mockProvider, name: 'mx' as any });
      service.registerProvider({ ...mockProvider, name: 'finicity' as any });
      service.registerProvider({ ...mockProvider, name: 'belvo' as any });
    });

    it('should return backups for plaid', async () => {
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      const backups = await service['getBackupProviders']('plaid' as any, 'US');

      expect(backups).toContain('mx' as any);
      expect(backups).toContain('finicity' as any);
    });

    it('should return backups for belvo in MX', async () => {
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      const backups = await service['getBackupProviders']('belvo' as any, 'MX');

      expect(backups).toContain('mx' as any);
    });

    it('should return backups for mx based on region', async () => {
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      const backupsMX = await service['getBackupProviders']('mx' as any, 'MX');
      expect(backupsMX).toContain('belvo' as any);

      const backupsUS = await service['getBackupProviders']('mx' as any, 'US');
      expect(backupsUS).toContain('plaid' as any);
      expect(backupsUS).toContain('finicity' as any);
    });

    it('should filter out providers with open circuit breakers', async () => {
      mockCircuitBreaker.isCircuitOpen
        .mockResolvedValueOnce(false) // mx: closed
        .mockResolvedValueOnce(true); // finicity: open

      const backups = await service['getBackupProviders']('plaid' as any, 'US');

      expect(backups).toEqual(['mx' as any]);
      expect(backups).not.toContain('finicity' as any);
    });

    it('should filter out unregistered providers', async () => {
      // Only plaid is registered
      service['providers'].clear();
      service.registerProvider({ ...mockProvider, name: 'plaid' as any });

      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);

      const backups = await service['getBackupProviders']('plaid' as any, 'US');

      expect(backups).toEqual([]); // mx and finicity not registered
    });
  });

  describe('getProviderHealth', () => {
    it('should retrieve provider health status for region', async () => {
      const mockHealth = [
        {
          provider: 'plaid' as any,
          region: 'US',
          status: 'healthy',
          circuitBreakerOpen: false,
        },
        {
          provider: 'mx' as any,
          region: 'US',
          status: 'degraded',
          circuitBreakerOpen: false,
        },
      ];

      mockPrisma.providerHealthStatus.findMany.mockResolvedValue(mockHealth);

      const health = await service.getProviderHealth('US');

      expect(health).toEqual(mockHealth);
      expect(mockPrisma.providerHealthStatus.findMany).toHaveBeenCalledWith({
        where: { region: 'US' },
        orderBy: { provider: 'asc' },
      });
    });

    it('should default to US region', async () => {
      mockPrisma.providerHealthStatus.findMany.mockResolvedValue([]);

      await service.getProviderHealth();

      expect(mockPrisma.providerHealthStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { region: 'US' },
        })
      );
    });
  });

  describe('getConnectionHistory', () => {
    it('should retrieve connection attempt history', async () => {
      const mockHistory = [
        {
          id: 'attempt-1',
          accountId: 'acc-1',
          provider: 'plaid' as any,
          status: 'success',
          attemptedAt: new Date(),
        },
        {
          id: 'attempt-2',
          accountId: 'acc-1',
          provider: 'plaid' as any,
          status: 'failure',
          attemptedAt: new Date(),
        },
      ];

      mockPrisma.connectionAttempt.findMany.mockResolvedValue(mockHistory);

      const history = await service.getConnectionHistory('acc-1', 5);

      expect(history).toEqual(mockHistory);
      expect(mockPrisma.connectionAttempt.findMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-1' },
        orderBy: { attemptedAt: 'desc' },
        take: 5,
      });
    });

    it('should default to 10 records', async () => {
      mockPrisma.connectionAttempt.findMany.mockResolvedValue([]);

      await service.getConnectionHistory('acc-1');

      expect(mockPrisma.connectionAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider);
      mockCircuitBreaker.isCircuitOpen.mockResolvedValue(false);
      mockCircuitBreaker.recordSuccess.mockResolvedValue();
      mockCircuitBreaker.recordFailure.mockResolvedValue();
    });

    it('should handle logging failures gracefully', async () => {
      mockPrisma.connectionAttempt.create.mockRejectedValue(new Error('DB error'));
      (mockProvider.createLink as jest.Mock).mockResolvedValue({ linkToken: 'token' });

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1' },
        'plaid' as any,
        'US'
      );

      // Should still succeed even if logging fails
      expect(result.success).toBe(true);
    });

    it('should handle ML selection failures gracefully', async () => {
      mockProviderSelection.selectOptimalProvider.mockRejectedValue(new Error('ML service down'));
      (mockProvider.createLink as jest.Mock).mockResolvedValue({ linkToken: 'token' });

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1', institutionId: 'inst-1', userId: 'user-1' },
        undefined,
        'US'
      );

      // Should fall back to default providers
      expect(result.success).toBe(true);
    });

    it('should skip unregistered providers and try backups', async () => {
      // When preferred provider is not registered, the service tries backup providers
      // mockProvider (plaid) is registered in beforeEach, so it will be used as backup for mx
      (mockProvider.createLink as jest.Mock).mockResolvedValue({ linkToken: 'token' });

      const result = await service.executeWithFailover(
        'createLink',
        { spaceId: 'space-1' },
        'mx' as any, // Not registered, but plaid is available as backup
        'US'
      );

      // Should succeed via plaid backup since plaid is registered
      expect(result.success).toBe(true);
      expect(result.provider).toBe('plaid');
    });
  });
});
