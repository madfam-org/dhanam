import { Provider, AccountType, Currency } from '@db';

import {
  IFinancialProvider,
  ProviderHealthCheck,
  CreateLinkParams,
  LinkResult,
  ExchangeTokenParams,
  ExchangeTokenResult,
  GetAccountsParams,
  ProviderAccount,
  SyncTransactionsParams,
  SyncTransactionsResult,
  WebhookHandlerResult,
} from '../../../modules/providers/orchestrator/provider.interface';

export type MockBehavior = 'succeed' | 'fail' | 'timeout';

export interface MockProviderConfig {
  name: Provider;
  behavior?: MockBehavior;
  delayMs?: number;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Configurable mock financial provider for chaos testing
 */
export class MockFinancialProvider implements IFinancialProvider {
  readonly name: Provider;
  private behavior: MockBehavior;
  private delayMs: number;
  private errorMessage: string;
  private errorCode: string;
  public callCount = 0;

  constructor(config: MockProviderConfig) {
    this.name = config.name;
    this.behavior = config.behavior ?? 'succeed';
    this.delayMs = config.delayMs ?? 0;
    this.errorMessage = config.errorMessage ?? 'Mock provider error';
    this.errorCode = config.errorCode ?? 'MOCK_ERROR';
  }

  setBehavior(behavior: MockBehavior): void {
    this.behavior = behavior;
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }

  setError(message: string, code?: string): void {
    this.errorMessage = message;
    if (code) this.errorCode = code;
  }

  private async execute<T>(result: T): Promise<T> {
    this.callCount++;
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    if (this.behavior === 'fail') {
      const error = new Error(this.errorMessage);
      (error as any).code = this.errorCode;
      throw error;
    }
    if (this.behavior === 'timeout') {
      // Never resolves
      return new Promise(() => {});
    }
    return result;
  }

  async healthCheck(): Promise<ProviderHealthCheck> {
    return this.execute({
      provider: this.name,
      status: 'healthy' as const,
      errorRate: 0,
      avgResponseTimeMs: 100,
      lastCheckedAt: new Date(),
    });
  }

  async createLink(_params: CreateLinkParams): Promise<LinkResult> {
    return this.execute({
      linkToken: 'mock-link-token',
      expiresAt: new Date(Date.now() + 3600000),
    });
  }

  async exchangeToken(_params: ExchangeTokenParams): Promise<ExchangeTokenResult> {
    return this.execute({
      accessToken: 'mock-access-token',
      itemId: 'mock-item-id',
    });
  }

  async getAccounts(_params: GetAccountsParams): Promise<ProviderAccount[]> {
    return this.execute([
      {
        providerAccountId: 'mock-account-1',
        name: 'Mock Checking',
        type: 'checking' as AccountType,
        currency: 'USD' as Currency,
        balance: 1000,
      },
    ]);
  }

  async syncTransactions(_params: SyncTransactionsParams): Promise<SyncTransactionsResult> {
    return this.execute({
      transactions: [],
      hasMore: false,
      addedCount: 0,
      modifiedCount: 0,
      removedCount: 0,
    });
  }

  async handleWebhook(_payload: any): Promise<WebhookHandlerResult> {
    return this.execute({ processed: true });
  }
}

/**
 * Create a set of mock providers for testing failover
 */
export function createMockProviderSet(
  configs?: Partial<MockProviderConfig>[]
): Map<Provider, MockFinancialProvider> {
  const defaults: MockProviderConfig[] = [
    { name: 'plaid' as Provider, behavior: 'succeed' },
    { name: 'belvo' as Provider, behavior: 'succeed' },
    { name: 'mx' as Provider, behavior: 'succeed' },
    { name: 'finicity' as Provider, behavior: 'succeed' },
  ];

  const providers = new Map<Provider, MockFinancialProvider>();

  const mergedConfigs = configs
    ? defaults.map((d, i) => ({ ...d, ...(configs[i] || {}) }))
    : defaults;

  for (const config of mergedConfigs) {
    providers.set(config.name, new MockFinancialProvider(config));
  }

  return providers;
}
