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

describe('Provider Failover Chaos Tests', () => {
  let orchestrator: ProviderOrchestratorService;
  let circuitBreaker: CircuitBreakerService;
  let mockPrisma: ReturnType<typeof createMockPrismaService>;
  let plaidProvider: MockFinancialProvider;
  let mxProvider: MockFinancialProvider;
  let finicityProvider: MockFinancialProvider;

  const mockProviderSelection = {
    selectOptimalProvider: jest.fn(),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    circuitBreaker = new CircuitBreakerService(mockPrisma as any);
    orchestrator = new ProviderOrchestratorService(
      mockPrisma as any,
      circuitBreaker,
      mockProviderSelection as any
    );

    plaidProvider = new MockFinancialProvider({ name: Provider.plaid as any });
    mxProvider = new MockFinancialProvider({ name: Provider.mx as any });
    finicityProvider = new MockFinancialProvider({ name: Provider.finicity as any });

    orchestrator.registerProvider(plaidProvider);
    orchestrator.registerProvider(mxProvider);
    orchestrator.registerProvider(finicityProvider);
  });

  afterEach(() => {
    mockPrisma.reset();
    jest.restoreAllMocks();
  });

  it('primary succeeds → no failover', async () => {
    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(true);
    expect(result.failoverUsed).toBe(false);
    expect(result.provider).toBe(Provider.plaid);
    expect(plaidProvider.callCount).toBe(1);
  });

  it('primary fails → backup succeeds with failoverUsed=true', async () => {
    plaidProvider.setBehavior('fail');
    plaidProvider.setError('network error', 'NETWORK');

    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(true);
    expect(result.failoverUsed).toBe(true);
    expect(plaidProvider.callCount).toBe(1);
    expect(mxProvider.callCount).toBe(1);
  });

  it('all US providers fail → returns failure with last error', async () => {
    plaidProvider.setBehavior('fail');
    plaidProvider.setError('network error', 'NET');
    mxProvider.setBehavior('fail');
    mxProvider.setError('network error', 'NET');
    finicityProvider.setBehavior('fail');
    finicityProvider.setError('unavailable', 'DOWN');

    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('auth error stops failover immediately', async () => {
    plaidProvider.setBehavior('fail');
    plaidProvider.setError('Authentication with plaid failed: invalid credentials', 'AUTH');

    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(false);
    // Auth errors are non-retryable, so it should stop after plaid
    expect(plaidProvider.callCount).toBe(1);
    expect(mxProvider.callCount).toBe(0);
  });

  it('circuit open → skips provider, starts with next', async () => {
    // Open circuit for plaid
    for (let i = 0; i < 5; i++) {
      await circuitBreaker.recordFailure(Provider.plaid as any, 'US', `Error ${i}`);
    }

    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(true);
    // Should have skipped plaid and gone to backup
    expect(plaidProvider.callCount).toBe(0);
    expect(mxProvider.callCount).toBe(1);
  });

  it('connection logging survives DB failure', async () => {
    // Make connectionAttempt.create fail
    mockPrisma.connectionAttempt.create.mockRejectedValue(new Error('DB down'));

    // Operation itself should still succeed
    const result = await orchestrator.executeWithFailover(
      'getAccounts',
      { spaceId: 's1', accessToken: 'tok', itemId: 'item1' },
      Provider.plaid as any,
      'US'
    );

    expect(result.success).toBe(true);
  });
});
