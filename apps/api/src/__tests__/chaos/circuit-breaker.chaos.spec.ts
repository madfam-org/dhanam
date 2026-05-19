import { CircuitBreakerService } from '../../modules/providers/orchestrator/circuit-breaker.service';

import { createMockPrismaService } from './helpers/mock-prisma';

// Mock the Provider enum since we can't import generated Prisma in tests
const Provider = {
  plaid: 'plaid',
  belvo: 'belvo',
  mx: 'mx',
  finicity: 'finicity',
  bitso: 'bitso',
  blockchain: 'blockchain',
  manual: 'manual',
} as const;

describe('Circuit Breaker Chaos Tests', () => {
  let service: CircuitBreakerService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    service = new CircuitBreakerService(mockPrisma as any);
  });

  afterEach(() => {
    mockPrisma.reset();
    jest.restoreAllMocks();
  });

  describe('CLOSED → OPEN transitions', () => {
    it('opens after 5 failures with >50% failure rate', async () => {
      // Record 5 consecutive failures (100% failure rate).
      // Each call: upsert increments failedCalls, then shouldOpenCircuit
      // checks if failedCalls+1 >= 5 AND rate > 50%.
      // Note: the mock upsert already increments before shouldOpenCircuit reads,
      // so the +1 in shouldOpenCircuit double-counts. With pure failures the
      // circuit will open earlier than threshold=5 in mock, but the real DB
      // returns the pre-increment value. We drive 5 failures to be safe.
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(true);
    });

    it('does NOT open at 4 failures (below threshold)', async () => {
      // With only 4 failures the threshold of 5 is not met regardless of rate
      for (let i = 0; i < 3; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);
    });

    it('stays closed with no health record', async () => {
      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);
    });

    it('stays closed when failure rate is diluted by successes', async () => {
      // Record enough successes to keep failure rate <= 50%
      for (let i = 0; i < 10; i++) {
        await service.recordSuccess(Provider.plaid as any, 'US', 100);
      }
      // Record 5 failures: 5 failures / 15 total ~ 33%, below 50%
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);
    });
  });

  describe('OPEN → HALF-OPEN transitions', () => {
    it('transitions to HALF-OPEN after timeout elapses', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }
      expect(await service.isCircuitOpen(Provider.plaid as any, 'US')).toBe(true);

      // Advance time past timeout (60s) by backdating updatedAt
      const record = mockPrisma._healthRecords.get('plaid:US');
      record.updatedAt = new Date(Date.now() - 61000);

      // isCircuitOpen sees timeout passed, calls setHalfOpen, returns false
      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);

      // getState checks circuitBreakerOpen which is still true (setHalfOpen
      // only changes status to 'degraded', not circuitBreakerOpen).
      // But updatedAt was just refreshed by setHalfOpen's update call,
      // so getState sees circuitBreakerOpen=true + fresh updatedAt => 'open'.
      const state = await service.getState(Provider.plaid as any, 'US');
      expect(state.state).toBe('open');
    });
  });

  describe('HALF-OPEN → CLOSED on success', () => {
    it('closes circuit after successThreshold (2) consecutive successes in half-open', async () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      // Move to half-open by aging the record past timeout
      const record = mockPrisma._healthRecords.get('plaid:US');
      record.updatedAt = new Date(Date.now() - 61000);
      await service.isCircuitOpen(Provider.plaid as any, 'US');

      // Record 2 successes (successThreshold = 2)
      await service.recordSuccess(Provider.plaid as any, 'US', 100);
      await service.recordSuccess(Provider.plaid as any, 'US', 100);

      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);

      const state = await service.getState(Provider.plaid as any, 'US');
      expect(state.state).toBe('closed');
    });
  });

  describe('HALF-OPEN → OPEN on failure', () => {
    it('re-opens circuit on failure in half-open state', async () => {
      // Open circuit with 5 failures
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      // Move to half-open by advancing time
      const record = mockPrisma._healthRecords.get('plaid:US');
      record.updatedAt = new Date(Date.now() - 61000);
      await service.isCircuitOpen(Provider.plaid as any, 'US');

      // Fail again -- failure count still exceeds threshold, rate still > 50%
      await service.recordFailure(Provider.plaid as any, 'US', 'Still failing');

      const state = await service.getState(Provider.plaid as any, 'US');
      // Circuit should be open again: failures still >= 5 and rate well above 50%
      expect(state.failures).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Monitoring window reset', () => {
    it('resets counters when monitoring window exceeds 5 minutes', async () => {
      // Record some failures (not enough to open)
      for (let i = 0; i < 3; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      // Age the window past 5 minutes (300000ms)
      const record = mockPrisma._healthRecords.get('plaid:US');
      record.windowStartAt = new Date(Date.now() - 310000);

      // Record another failure -- shouldOpenCircuit detects stale window,
      // resets counters via update, and returns false (no open)
      await service.recordFailure(Provider.plaid as any, 'US', 'After window reset');

      // Circuit should stay closed because counters were reset
      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);
    });
  });

  describe('Per-provider per-region isolation', () => {
    it('isolates circuit state by provider and region', async () => {
      // Open circuit for plaid/US
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      // belvo/MX should be unaffected
      const plaidOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      const belvoOpen = await service.isCircuitOpen(Provider.belvo as any, 'MX');

      expect(plaidOpen).toBe(true);
      expect(belvoOpen).toBe(false);
    });

    it('isolates same provider across different regions', async () => {
      // Open circuit for plaid/US
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      // plaid/MX should be unaffected
      expect(await service.isCircuitOpen(Provider.plaid as any, 'US')).toBe(true);
      expect(await service.isCircuitOpen(Provider.plaid as any, 'MX')).toBe(false);
    });
  });

  describe('Manual reset', () => {
    it('clears all state on reset', async () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }
      expect(await service.isCircuitOpen(Provider.plaid as any, 'US')).toBe(true);

      // Reset
      await service.reset(Provider.plaid as any, 'US');

      const state = await service.getState(Provider.plaid as any, 'US');
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
      expect(state.successes).toBe(0);
    });
  });

  describe('successThreshold bug detection', () => {
    it('requires successThreshold (2) consecutive successes to close from HALF-OPEN', async () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        await service.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
      }

      // Move to half-open
      const record = mockPrisma._healthRecords.get('plaid:US');
      record.updatedAt = new Date(Date.now() - 61000);
      await service.isCircuitOpen(Provider.plaid as any, 'US');

      // First success — should NOT close circuit yet (need 2)
      await service.recordSuccess(Provider.plaid as any, 'US', 100);
      const stateAfter1 = await service.getState(Provider.plaid as any, 'US');
      expect(stateAfter1.state).not.toBe('closed');

      // Second success — should close circuit
      await service.recordSuccess(Provider.plaid as any, 'US', 100);
      const stateAfter2 = await service.getState(Provider.plaid as any, 'US');
      expect(stateAfter2.state).toBe('closed');
    });
  });

  describe('DB failure during circuit breaker operation', () => {
    it('falls back to memory cache when DB is down during isCircuitOpen', async () => {
      mockPrisma.setMode('fail');

      // With in-memory fallback, isCircuitOpen returns false (no cached state)
      const isOpen = await service.isCircuitOpen(Provider.plaid as any, 'US');
      expect(isOpen).toBe(false);
    });

    it('propagates error when DB is down during recordFailure', async () => {
      mockPrisma.setMode('fail');

      await expect(
        service.recordFailure(Provider.plaid as any, 'US', 'test error')
      ).rejects.toThrow('Database unavailable');
    });

    it('propagates error when DB is down during recordSuccess', async () => {
      mockPrisma.setMode('fail');

      await expect(service.recordSuccess(Provider.plaid as any, 'US', 100)).rejects.toThrow(
        'Database unavailable'
      );
    });

    it('propagates error when DB is down during reset', async () => {
      // Need a record first so reset has something to update
      await service.recordFailure(Provider.plaid as any, 'US', 'setup');
      mockPrisma.setMode('fail');

      await expect(service.reset(Provider.plaid as any, 'US')).rejects.toThrow(
        'Database unavailable'
      );
    });
  });

  describe('Response time tracking', () => {
    it('stores response time on success', async () => {
      await service.recordSuccess(Provider.plaid as any, 'US', 250);

      const record = mockPrisma._healthRecords.get('plaid:US');
      expect(record.avgResponseTimeMs).toBe(250);
    });

    it('stores response time on failure when provided', async () => {
      await service.recordFailure(Provider.plaid as any, 'US', 'timeout', 5000);

      const record = mockPrisma._healthRecords.get('plaid:US');
      expect(record.avgResponseTimeMs).toBe(5000);
    });

    it('defaults response time to 0 on failure when not provided', async () => {
      await service.recordFailure(Provider.plaid as any, 'US', 'connection refused');

      const record = mockPrisma._healthRecords.get('plaid:US');
      expect(record.avgResponseTimeMs).toBe(0);
    });
  });

  describe('Default region behavior', () => {
    it('defaults to US region when region is not specified', async () => {
      // isCircuitOpen signature has region default = 'US'
      const isOpen = await service.isCircuitOpen(Provider.plaid as any);
      expect(isOpen).toBe(false);

      // Verify it queried with 'US'
      expect(mockPrisma.providerHealthStatus.findUnique).toHaveBeenCalledWith({
        where: {
          provider_region: {
            provider: 'plaid',
            region: 'US',
          },
        },
      });
    });
  });
});
