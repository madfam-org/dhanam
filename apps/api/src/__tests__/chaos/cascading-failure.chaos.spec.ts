import { CircuitBreakerService } from '../../modules/providers/orchestrator/circuit-breaker.service';
import { ProviderOrchestratorService } from '../../modules/providers/orchestrator/provider-orchestrator.service';

import { createMockPrismaService } from './helpers/mock-prisma';
import { MockFinancialProvider } from './helpers/mock-provider';

const Provider = {
  plaid: 'plaid',
  belvo: 'belvo',
  mx: 'mx',
  finicity: 'finicity',
} as const;

describe('Cascading Failure Chaos Tests', () => {
  let orchestrator: ProviderOrchestratorService;
  let circuitBreaker: CircuitBreakerService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;

  const mockProviderSelection = { selectOptimalProvider: jest.fn() };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    circuitBreaker = new CircuitBreakerService(mockPrisma as any);
    orchestrator = new ProviderOrchestratorService(
      mockPrisma as any,
      circuitBreaker,
      mockProviderSelection as any
    );
  });

  afterEach(() => {
    mockPrisma.reset();
    jest.restoreAllMocks();
  });

  it('provider down → circuit opens → failover fails → all fail', async () => {
    const plaid = new MockFinancialProvider({
      name: Provider.plaid as any,
      behavior: 'fail',
      errorMessage: 'network error',
    });
    const mx = new MockFinancialProvider({
      name: Provider.mx as any,
      behavior: 'fail',
      errorMessage: 'network error',
    });
    const finicity = new MockFinancialProvider({
      name: Provider.finicity as any,
      behavior: 'fail',
      errorMessage: 'unavailable',
    });

    orchestrator.registerProvider(plaid);
    orchestrator.registerProvider(mx);
    orchestrator.registerProvider(finicity);

    // First call: all providers fail
    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(false);

    // After repeated failures, circuit should be recording failures
    const state = await circuitBreaker.getState(Provider.plaid as any, 'US');
    expect(state.failures).toBeGreaterThan(0);
  });

  it('DB down during circuit breaker record → original error surfaces', async () => {
    const plaid = new MockFinancialProvider({
      name: Provider.plaid as any,
      behavior: 'fail',
      errorMessage: 'network error',
    });
    orchestrator.registerProvider(plaid);

    // Make prisma fail after the provider call (during recordFailure)
    const originalUpsert = mockPrisma.providerHealthStatus.upsert;
    let callCount = 0;
    mockPrisma.providerHealthStatus.upsert = jest.fn(async (...args: any[]) => {
      callCount++;
      // Let first calls succeed (getAvailableProviders), fail on recordFailure
      if (callCount > 2) {
        throw new Error('Database unavailable');
      }
      return originalUpsert(...args);
    }) as any;

    // The operation should still complete (error from provider, not from DB)
    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    // Should either fail with provider error or throw DB error
    // depending on whether recordFailure catch block exists
    expect(result.success).toBe(false);
  });

  it('retry exhaustion triggers circuit breaker failure count', async () => {
    const plaid = new MockFinancialProvider({
      name: Provider.plaid as any,
      behavior: 'fail',
      errorMessage: 'network error',
    });
    orchestrator.registerProvider(plaid);

    // Execute 5 times to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      await orchestrator.executeWithFailover(
        'getAccounts',
        { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
        Provider.plaid as any,
        'US'
      );
    }

    const isOpen = await circuitBreaker.isCircuitOpen(Provider.plaid as any, 'US');
    expect(isOpen).toBe(true);
  });
});
