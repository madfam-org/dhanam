import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrisma = {
    providerHealthStatus: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    // Suppress logger output
    module.get<CircuitBreakerService>(CircuitBreakerService)['logger'] = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    prismaService = module.get(PrismaService);
  });

  describe('isCircuitOpen', () => {
    it('should return false when no health record exists', async () => {
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      const isOpen = await service.isCircuitOpen('belvo' as any, 'MX');

      expect(isOpen).toBe(false);
      expect(prismaService.providerHealthStatus.findUnique).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'belvo' as any,
            region: 'MX',
          },
        },
      });
    });

    it('should return false when circuit is closed', async () => {
      const mockHealth = {
        id: 'health-1',
        provider: 'plaid' as any,
        region: 'US',
        circuitBreakerOpen: false,
        status: 'healthy',
        successfulCalls: 10,
        failedCalls: 0,
        updatedAt: new Date(),
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const isOpen = await service.isCircuitOpen('plaid' as any, 'US');

      expect(isOpen).toBe(false);
    });

    it('should return true when circuit is open and timeout has not passed', async () => {
      const now = new Date();
      const recentTime = new Date(now.getTime() - 30000); // 30 seconds ago

      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        circuitBreakerOpen: true,
        status: 'down',
        successfulCalls: 0,
        failedCalls: 10,
        updatedAt: recentTime,
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const isOpen = await service.isCircuitOpen('belvo' as any, 'MX');

      expect(isOpen).toBe(true);
    });

    it('should move to half-open state when timeout has passed', async () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 70000); // 70 seconds ago (> 60s timeout)

      const mockHealth = {
        id: 'health-1',
        provider: 'bitso' as any,
        region: 'MX',
        circuitBreakerOpen: true,
        status: 'down',
        successfulCalls: 0,
        failedCalls: 10,
        updatedAt: oldTime,
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);
      mockPrisma.providerHealthStatus.update.mockResolvedValue({} as any);

      const isOpen = await service.isCircuitOpen('bitso' as any, 'MX');

      expect(isOpen).toBe(false); // Allows one attempt in half-open
      expect(prismaService.providerHealthStatus.update).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'bitso' as any,
            region: 'MX',
          },
        },
        data: {
          status: 'degraded',
        },
      });
    });
  });

  describe('recordSuccess', () => {
    it('should create health record on first success', async () => {
      mockPrisma.providerHealthStatus.upsert.mockResolvedValue({} as any);

      await service.recordSuccess('plaid' as any, 'US', 250);

      expect(prismaService.providerHealthStatus.upsert).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'plaid' as any,
            region: 'US',
          },
        },
        create: {
          provider: 'plaid' as any,
          region: 'US',
          status: 'healthy',
          successfulCalls: 1,
          failedCalls: 0,
          avgResponseTimeMs: 250,
          lastSuccessAt: expect.any(Date),
          circuitBreakerOpen: false,
          windowStartAt: expect.any(Date),
        },
        update: {
          successfulCalls: { increment: 1 },
          lastSuccessAt: expect.any(Date),
          avgResponseTimeMs: 250,
          status: 'healthy',
          circuitBreakerOpen: false,
        },
      });
    });

    it('should increment successful calls on subsequent success', async () => {
      await service.recordSuccess('belvo' as any, 'MX', 350);

      const updateCall = mockPrisma.providerHealthStatus.upsert.mock.calls[0][0];
      expect(updateCall.update.successfulCalls).toEqual({ increment: 1 });
      expect(updateCall.update.status).toBe('healthy');
      expect(updateCall.update.circuitBreakerOpen).toBe(false);
    });

    it('should close circuit on success (reset from open state)', async () => {
      await service.recordSuccess('belvo' as any, 'MX', 200);

      const updateCall = mockPrisma.providerHealthStatus.upsert.mock.calls[0][0];
      expect(updateCall.update.circuitBreakerOpen).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('should create health record on first failure', async () => {
      const mockHealth = {
        id: 'health-1',
        provider: 'plaid' as any,
        region: 'US',
        failedCalls: 1,
        successfulCalls: 0,
        windowStartAt: new Date(),
      };

      mockPrisma.providerHealthStatus.upsert.mockResolvedValue(mockHealth as any);
      mockPrisma.providerHealthStatus.update.mockResolvedValue({} as any);

      await service.recordFailure('plaid' as any, 'US', 'Connection timeout', 5000);

      expect(prismaService.providerHealthStatus.upsert).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'plaid' as any,
            region: 'US',
          },
        },
        create: {
          provider: 'plaid' as any,
          region: 'US',
          status: 'degraded',
          successfulCalls: 0,
          failedCalls: 1,
          avgResponseTimeMs: 5000,
          lastFailureAt: expect.any(Date),
          lastError: 'Connection timeout',
          circuitBreakerOpen: false,
          windowStartAt: expect.any(Date),
        },
        update: {
          failedCalls: { increment: 1 },
          lastFailureAt: expect.any(Date),
          lastError: 'Connection timeout',
          status: 'degraded',
        },
      });
    });

    it('should open circuit after reaching failure threshold', async () => {
      const now = new Date();
      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        failedCalls: 4, // Will become 5 after this failure
        successfulCalls: 0,
        windowStartAt: new Date(now.getTime() - 60000), // 1 minute ago
      };

      mockPrisma.providerHealthStatus.upsert.mockResolvedValue(mockHealth as any);
      mockPrisma.providerHealthStatus.update.mockResolvedValue({} as any);

      await service.recordFailure('belvo' as any, 'MX', 'API error');

      // Should call update to open circuit
      expect(prismaService.providerHealthStatus.update).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'belvo' as any,
            region: 'MX',
          },
        },
        data: {
          circuitBreakerOpen: true,
          status: 'down',
        },
      });
    });

    it('should not open circuit if failure rate is below 50%', async () => {
      const now = new Date();
      const mockHealth = {
        id: 'health-1',
        provider: 'plaid' as any,
        region: 'US',
        failedCalls: 4, // Will become 5
        successfulCalls: 10, // Total: 15 calls, failure rate = 5/15 = 33.3%
        windowStartAt: new Date(now.getTime() - 60000),
      };

      mockPrisma.providerHealthStatus.upsert.mockResolvedValue(mockHealth as any);

      await service.recordFailure('plaid' as any, 'US', 'Minor error');

      // Should NOT open circuit since failure rate < 50%
      expect(prismaService.providerHealthStatus.update).not.toHaveBeenCalled();
    });

    it('should reset window if older than monitoring window', async () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 400000); // 6+ minutes ago (> 5 min window)

      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        failedCalls: 10,
        successfulCalls: 0,
        windowStartAt: oldTime,
      };

      mockPrisma.providerHealthStatus.upsert.mockResolvedValue(mockHealth as any);
      mockPrisma.providerHealthStatus.update.mockResolvedValue({} as any);

      await service.recordFailure('belvo' as any, 'MX', 'Error');

      // Should reset window instead of opening circuit
      expect(prismaService.providerHealthStatus.update).toHaveBeenCalledWith({
        where: { id: 'health-1' },
        data: {
          successfulCalls: 0,
          failedCalls: 0,
          windowStartAt: expect.any(Date),
        },
      });
    });
  });

  describe('getState', () => {
    it('should return closed state when no health record exists', async () => {
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);

      const state = await service.getState('plaid' as any, 'US');

      expect(state).toEqual({
        provider: 'plaid' as any,
        region: 'US',
        state: 'closed',
        failures: 0,
        successes: 0,
      });
    });

    it('should return closed state when circuit is not open', async () => {
      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        circuitBreakerOpen: false,
        status: 'healthy',
        successfulCalls: 50,
        failedCalls: 2,
        lastSuccessAt: new Date('2023-12-01'),
        lastFailureAt: new Date('2023-11-30'),
        updatedAt: new Date(),
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const state = await service.getState('belvo' as any, 'MX');

      expect(state).toEqual({
        provider: 'belvo' as any,
        region: 'MX',
        state: 'closed',
        failures: 2,
        successes: 50,
        lastFailureAt: new Date('2023-11-30'),
        lastSuccessAt: new Date('2023-12-01'),
      });
    });

    it('should return open state when circuit is open and timeout has not passed', async () => {
      const now = new Date();
      const recentTime = new Date(now.getTime() - 30000); // 30 seconds ago

      const mockHealth = {
        id: 'health-1',
        provider: 'bitso' as any,
        region: 'MX',
        circuitBreakerOpen: true,
        status: 'down',
        successfulCalls: 0,
        failedCalls: 10,
        lastSuccessAt: null,
        lastFailureAt: new Date(),
        updatedAt: recentTime,
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const state = await service.getState('bitso' as any, 'MX');

      expect(state.state).toBe('open');
      expect(state.failures).toBe(10);
      expect(state.nextAttemptAt).toBeInstanceOf(Date);
      expect(state.nextAttemptAt!.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should return half-open state when timeout has passed', async () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 70000); // 70 seconds ago

      const mockHealth = {
        id: 'health-1',
        provider: 'plaid' as any,
        region: 'US',
        circuitBreakerOpen: true,
        status: 'down',
        successfulCalls: 0,
        failedCalls: 8,
        lastSuccessAt: null,
        lastFailureAt: new Date(),
        updatedAt: oldTime,
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const state = await service.getState('plaid' as any, 'US');

      expect(state.state).toBe('half-open');
      expect(state.failures).toBe(8);
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to healthy state', async () => {
      mockPrisma.providerHealthStatus.update.mockResolvedValue({} as any);

      await service.reset('belvo' as any, 'MX');

      expect(prismaService.providerHealthStatus.update).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'belvo' as any,
            region: 'MX',
          },
        },
        data: {
          circuitBreakerOpen: false,
          status: 'healthy',
          successfulCalls: 0,
          failedCalls: 0,
          errorRate: 0,
          windowStartAt: expect.any(Date),
        },
      });
    });
  });

  describe('getState edge cases', () => {
    it('should handle lastFailureAt being null', async () => {
      const mockHealth = {
        id: 'health-1',
        provider: 'plaid' as any,
        region: 'US',
        circuitBreakerOpen: false,
        status: 'healthy',
        successfulCalls: 10,
        failedCalls: 0,
        lastSuccessAt: new Date(),
        lastFailureAt: null, // null case
        updatedAt: new Date(),
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const state = await service.getState('plaid' as any, 'US');

      expect(state.lastFailureAt).toBeUndefined();
      expect(state.lastSuccessAt).toBeDefined();
    });

    it('should handle lastSuccessAt being null', async () => {
      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        circuitBreakerOpen: false,
        status: 'degraded',
        successfulCalls: 0,
        failedCalls: 3,
        lastSuccessAt: null, // null case
        lastFailureAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const state = await service.getState('belvo' as any, 'MX');

      expect(state.lastSuccessAt).toBeUndefined();
      expect(state.lastFailureAt).toBeDefined();
    });

    it('should return undefined for nextAttemptAt when state is half-open', async () => {
      const now = new Date();
      const oldTime = new Date(now.getTime() - 70000); // > timeout

      const mockHealth = {
        id: 'health-1',
        provider: 'plaid' as any,
        region: 'US',
        circuitBreakerOpen: true,
        status: 'degraded',
        successfulCalls: 0,
        failedCalls: 5,
        lastSuccessAt: null,
        lastFailureAt: new Date(),
        updatedAt: oldTime,
      };

      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(mockHealth);

      const state = await service.getState('plaid' as any, 'US');

      expect(state.state).toBe('half-open');
      expect(state.nextAttemptAt).toBeUndefined();
    });
  });

  describe('shouldOpenCircuit edge cases', () => {
    it('should handle zero total calls with failureRate fallback', async () => {
      // This tests the edge case where totalCalls could be 0
      // failedCalls: -1 + 1 = 0, successfulCalls: 0
      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        failedCalls: 0, // Will be 1 after this failure
        successfulCalls: 0, // Total will be 1
        windowStartAt: new Date(Date.now() - 60000),
      };

      mockPrisma.providerHealthStatus.upsert.mockResolvedValue(mockHealth as any);

      await service.recordFailure('belvo' as any, 'MX', 'First error');

      // Should not open circuit with just 1 failure (threshold is 5)
      expect(prismaService.providerHealthStatus.update).not.toHaveBeenCalled();
    });
  });

  describe('circuit breaker workflow', () => {
    it('should handle full circuit breaker lifecycle', async () => {
      const now = new Date();

      // 1. Start with healthy state
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(null);
      let isOpen = await service.isCircuitOpen('belvo' as any, 'MX');
      expect(isOpen).toBe(false);

      // 2. Record some successes
      mockPrisma.providerHealthStatus.upsert.mockResolvedValue({} as any);
      await service.recordSuccess('belvo' as any, 'MX', 200);
      await service.recordSuccess('belvo' as any, 'MX', 250);

      // 3. Record failures to trigger circuit open
      const mockHealth = {
        id: 'health-1',
        provider: 'belvo' as any,
        region: 'MX',
        failedCalls: 4,
        successfulCalls: 2,
        windowStartAt: new Date(now.getTime() - 60000),
      };

      mockPrisma.providerHealthStatus.upsert.mockResolvedValue(mockHealth as any);
      mockPrisma.providerHealthStatus.update.mockResolvedValue({} as any);

      await service.recordFailure('belvo' as any, 'MX', 'Error'); // 5th failure
      expect(prismaService.providerHealthStatus.update).toHaveBeenCalled();

      // 4. Circuit should be open
      const openHealth = {
        ...mockHealth,
        circuitBreakerOpen: true,
        status: 'down',
        updatedAt: new Date(now.getTime() - 30000),
      };
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(openHealth);
      isOpen = await service.isCircuitOpen('belvo' as any, 'MX');
      expect(isOpen).toBe(true);

      // 5. After timeout, moves to half-open
      const halfOpenHealth = {
        ...openHealth,
        updatedAt: new Date(now.getTime() - 70000), // > 60s
      };
      mockPrisma.providerHealthStatus.findUnique.mockResolvedValue(halfOpenHealth);
      isOpen = await service.isCircuitOpen('belvo' as any, 'MX');
      expect(isOpen).toBe(false); // Allows one attempt

      // 6. Success closes the circuit
      await service.recordSuccess('belvo' as any, 'MX', 220);
      const successUpdate = mockPrisma.providerHealthStatus.upsert.mock.calls.slice(-1)[0][0];
      expect(successUpdate.update.circuitBreakerOpen).toBe(false);
    });
  });
});
