import { Injectable, Logger } from '@nestjs/common';

import { Provider } from '@db';

import { EventsService } from '../../../core/events/events.service';
import { ProviderException } from '../../../core/exceptions/domain-exceptions';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProviderSelectionService } from '../../ml/provider-selection.service';

import { CircuitBreakerService } from './circuit-breaker.service';
import {
  IFinancialProvider,
  ProviderAttemptResult,
  ProviderError,
  CreateLinkParams,
  ExchangeTokenParams,
  GetAccountsParams,
  SyncTransactionsParams,
} from './provider.interface';

/**
 * Union of every operation's params shape. Each call site already passes the
 * correct concrete type, but the orchestrator's generic `operation` switch
 * needs a permissive supertype that exposes the cross-cutting routing fields
 * (userId, spaceId, institutionId, accountId) to the orchestrator's logging
 * + ML-selection paths without losing strict checking on the per-operation
 * cast that happens inside the switch.
 */
type ProviderOperationParams =
  | CreateLinkParams
  | ExchangeTokenParams
  | GetAccountsParams
  | SyncTransactionsParams;

/**
 * Routing fields read by the orchestrator across all operations. All optional
 * because not every operation supplies every field (e.g. exchangeToken doesn't
 * carry an accountId; getAccounts doesn't carry an institutionId). Computed
 * defensively from the params at the top of executeWithFailover.
 */
interface OrchestratorRoutingFields {
  userId?: string;
  spaceId?: string;
  institutionId?: string;
  accountId?: string;
}

function pickRoutingFields(params: ProviderOperationParams): OrchestratorRoutingFields {
  const p = params as Partial<
    CreateLinkParams & ExchangeTokenParams & GetAccountsParams & SyncTransactionsParams
  >;
  return {
    userId: p.userId,
    spaceId: p.spaceId,
    institutionId: p.institutionId,
    accountId: p.accountId,
  };
}

/**
 * Provider Orchestrator Service
 *
 * Coordinates multiple financial data providers (Plaid, Belvo, MX, Finicity, Bitso)
 * with intelligent failover and circuit breaker pattern for high availability.
 *
 * ## Architecture
 * - Uses ML-based provider selection for optimal routing
 * - Implements circuit breaker pattern to prevent cascading failures
 * - Supports automatic failover when primary providers fail
 * - Logs all connection attempts for monitoring and analytics
 *
 * ## Provider Priority by Region
 * - **Mexico (MX)**: Belvo → MX
 * - **US/Canada**: Plaid → MX → Finicity
 * - **Crypto**: Bitso (exchange) + Blockchain (on-chain)
 *
 * ## Error Handling
 * - Auth errors: Non-retryable (requires user intervention)
 * - Rate limits: Retryable with backoff
 * - Network errors: Retryable with failover
 * - Provider down: Circuit breaker opens, failover to backup
 *
 * @example
 * ```typescript
 * // Execute operation with automatic failover
 * const result = await orchestrator.executeWithFailover(
 *   'syncTransactions',
 *   { spaceId, accountId, userId },
 *   Provider.plaid,
 *   'US'
 * );
 *
 * if (result.success) {
 *   console.log(`Synced via ${result.provider} in ${result.responseTimeMs}ms`);
 * }
 * ```
 *
 * @see CircuitBreakerService - Circuit breaker implementation
 * @see ProviderSelectionService - ML-based provider selection
 */
@Injectable()
export class ProviderOrchestratorService {
  private readonly logger = new Logger(ProviderOrchestratorService.name);
  private providers: Map<Provider, IFinancialProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    private circuitBreaker: CircuitBreakerService,
    private providerSelection: ProviderSelectionService,
    private eventsService: EventsService
  ) {}

  /**
   * Register a financial provider implementation
   *
   * Called during module initialization to make providers available
   * for the orchestrator to use during operations.
   *
   * @param provider - Provider implementation conforming to IFinancialProvider interface
   *
   * @example
   * ```typescript
   * orchestrator.registerProvider(plaidProvider);
   * orchestrator.registerProvider(belvoProvider);
   * ```
   */
  registerProvider(provider: IFinancialProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered provider: ${provider.name}`);
  }

  /**
   * Get available providers for a financial institution
   *
   * Looks up institution-provider mappings and filters out providers
   * with open circuit breakers.
   *
   * @param institutionId - External institution identifier (e.g., Plaid institution_id)
   * @param region - Geographic region code ('US', 'MX', 'CA')
   * @returns Array of available providers, ordered by priority
   *
   * @example
   * ```typescript
   * const providers = await orchestrator.getAvailableProviders('ins_123', 'MX');
   * // Returns: [Provider.belvo, Provider.mx]
   * ```
   */
  async getAvailableProviders(institutionId: string, region: string = 'US'): Promise<Provider[]> {
    const mapping = await this.prisma.institutionProviderMapping.findFirst({
      where: {
        institutionId,
        region,
      },
    });

    if (!mapping) {
      // Return default provider based on region
      return region === 'MX' ? [Provider.belvo] : [Provider.plaid];
    }

    const providers = [mapping.primaryProvider];

    // Add backup providers
    if (mapping.backupProviders) {
      const backups = mapping.backupProviders as Provider[];
      providers.push(...backups);
    }

    // Filter out providers with open circuit breakers
    const availableProviders: Provider[] = [];
    for (const provider of providers) {
      const isOpen = await this.circuitBreaker.isCircuitOpen(provider, region);
      if (!isOpen) {
        availableProviders.push(provider);
      }
    }

    if (availableProviders.length === 0) {
      this.logger.error(
        `All providers for institution ${institutionId} have open circuit breakers!`
      );
      throw ProviderException.circuitOpen(mapping.primaryProvider);
    }

    return availableProviders;
  }

  /**
   * Execute a provider operation with automatic failover and ML-based selection
   *
   * This is the main entry point for all provider operations. It handles:
   * 1. ML-based optimal provider selection (if no preference specified)
   * 2. Circuit breaker checks before attempting operations
   * 3. Sequential failover through backup providers on failure
   * 4. Logging of all attempts for monitoring
   *
   * @template T - Return type of the operation
   * @param operation - The operation to execute ('createLink' | 'exchangeToken' | 'getAccounts' | 'syncTransactions')
   * @param params - Operation-specific parameters (varies by operation type)
   * @param preferredProvider - Optional preferred provider (ML selects if not specified)
   * @param region - Geographic region for provider selection ('US' | 'MX' | 'CA')
   * @returns Promise resolving to ProviderAttemptResult with success/failure status
   *
   * @example
   * ```typescript
   * // Sync transactions with automatic provider selection
   * const result = await orchestrator.executeWithFailover<Transaction[]>(
   *   'syncTransactions',
   *   { spaceId: 'space-123', accountId: 'acc-456', userId: 'user-789' },
   *   undefined, // Let ML select
   *   'US'
   * );
   *
   * if (result.success) {
   *   console.log(`Got ${result.data.length} transactions`);
   *   if (result.failoverUsed) {
   *     console.log(`Primary failed, used ${result.provider}`);
   *   }
   * } else {
   *   console.error(`All providers failed: ${result.error.message}`);
   * }
   * ```
   */
  async executeWithFailover<T>(
    operation: 'createLink' | 'exchangeToken' | 'getAccounts' | 'syncTransactions',
    params: ProviderOperationParams,
    preferredProvider?: Provider,
    region: string = 'US'
  ): Promise<ProviderAttemptResult<T>> {
    const startTime = Date.now();
    const routing = pickRoutingFields(params);

    // Use ML to select optimal provider if no preference specified
    if (!preferredProvider && routing.institutionId) {
      try {
        preferredProvider = await this.providerSelection.selectOptimalProvider(
          routing.institutionId,
          region,
          routing.userId
        );
        this.logger.log(`ML selected optimal provider: ${preferredProvider}`);
      } catch (error) {
        this.logger.warn(`ML selection failed, using defaults: ${error}`);
      }
    }

    // Determine which providers to try
    let providersToTry: Provider[];
    if (preferredProvider) {
      const isOpen = await this.circuitBreaker.isCircuitOpen(preferredProvider, region);
      if (isOpen) {
        this.logger.warn(
          `Preferred provider ${preferredProvider} has open circuit breaker. Trying alternatives.`
        );
        providersToTry = await this.getBackupProviders(preferredProvider, region);
      } else {
        providersToTry = [preferredProvider];
        // Add backups in case primary fails
        const backups = await this.getBackupProviders(preferredProvider, region);
        providersToTry.push(...backups);
      }
    } else {
      providersToTry =
        region === 'MX' ? [Provider.belvo, Provider.mx] : [Provider.plaid, Provider.mx];
    }

    let lastError: ProviderError | undefined;

    // Try each provider in sequence
    for (let i = 0; i < providersToTry.length; i++) {
      const provider = providersToTry[i];
      const providerImpl = this.providers.get(provider);

      if (!providerImpl) {
        this.logger.warn(`Provider ${provider} not registered, skipping`);
        continue;
      }

      const attemptStartTime = Date.now();

      try {
        this.logger.log(
          `Attempting ${operation} with ${provider} (attempt ${i + 1}/${providersToTry.length})`
        );

        // Execute the operation
        let result: unknown;
        switch (operation) {
          case 'createLink':
            result = await providerImpl.createLink(params as CreateLinkParams);
            break;
          case 'exchangeToken':
            result = await providerImpl.exchangeToken(params as ExchangeTokenParams);
            break;
          case 'getAccounts':
            result = await providerImpl.getAccounts(params as GetAccountsParams);
            break;
          case 'syncTransactions':
            result = await providerImpl.syncTransactions(params as SyncTransactionsParams);
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }

        const responseTimeMs = Date.now() - attemptStartTime;

        // Record success
        await this.circuitBreaker.recordSuccess(provider, region, responseTimeMs);

        // Log connection attempt
        await this.logConnectionAttempt({
          spaceId: routing.spaceId ?? '',
          accountId: routing.accountId,
          provider,
          institutionId: routing.institutionId,
          attemptType: operation,
          status: 'success',
          responseTimeMs,
          failoverUsed: i > 0, // Failover if not the first attempt
        });

        this.logger.log(`✅ ${operation} succeeded with ${provider} in ${responseTimeMs}ms`);

        // Emit real-time events to the connected user (SSE)
        if (routing.userId) {
          this.emitRealtimeEvents(operation, routing.userId, provider, routing.accountId);
        }

        return {
          success: true,
          data: result as T,
          provider,
          responseTimeMs: Date.now() - startTime,
          failoverUsed: i > 0,
        };
      } catch (error: unknown) {
        const responseTimeMs = Date.now() - attemptStartTime;

        lastError = this.parseError(error, provider);

        // Record failure
        await this.circuitBreaker.recordFailure(
          provider,
          region,
          lastError.message,
          responseTimeMs
        );

        // Log failed attempt
        await this.logConnectionAttempt({
          spaceId: routing.spaceId ?? '',
          accountId: routing.accountId,
          provider,
          institutionId: routing.institutionId,
          attemptType: operation,
          status: 'failure',
          errorCode: lastError.code,
          errorMessage: lastError.message,
          responseTimeMs,
        });

        this.logger.error(
          `❌ ${operation} failed with ${provider}: ${lastError.message} (${lastError.code})`
        );

        // If error is not retryable or this is the last provider, stop
        if (!lastError.retryable || i === providersToTry.length - 1) {
          break;
        }

        // Continue to next provider
        this.logger.log(`Retrying with next provider...`);
      }
    }

    // All providers failed
    this.logger.error(
      `🚨 All providers failed for ${operation}. Last error: ${lastError?.message}`
    );

    return {
      success: false,
      error: lastError,
      provider: providersToTry[0], // Return first attempted provider
      responseTimeMs: Date.now() - startTime,
      failoverUsed: providersToTry.length > 1,
    };
  }

  /**
   * Emit real-time SSE events to the user after a successful provider operation.
   *
   * Maps provider operations to the appropriate event types:
   * - syncTransactions -> sync.complete + transaction.new
   * - getAccounts      -> sync.complete + balance.updated
   * - exchangeToken    -> sync.complete
   * - createLink       -> (no event — link creation is not a data sync)
   */
  private emitRealtimeEvents(
    operation: string,
    userId: string,
    provider: Provider,
    accountId?: string
  ): void {
    try {
      const base = { provider, accountId };

      if (operation === 'syncTransactions') {
        this.eventsService.emit(userId, 'sync.complete', { ...base, operation });
        this.eventsService.emit(userId, 'transaction.new', base);
        this.eventsService.emit(userId, 'balance.updated', base);
      } else if (operation === 'getAccounts') {
        this.eventsService.emit(userId, 'sync.complete', { ...base, operation });
        this.eventsService.emit(userId, 'balance.updated', base);
      } else if (operation === 'exchangeToken') {
        this.eventsService.emit(userId, 'sync.complete', { ...base, operation });
      }
      // createLink does not emit — no data changed yet
    } catch (error) {
      // Never let event emission break the main flow
      this.logger.warn(`Failed to emit realtime event for ${operation}: ${error}`);
    }
  }

  /**
   * Get backup providers for failover
   *
   * Returns region-appropriate backup providers when primary fails.
   * Filters out providers with open circuit breakers.
   *
   * @param primaryProvider - The primary provider that failed
   * @param region - Geographic region for backup selection
   * @returns Array of available backup providers
   */
  private async getBackupProviders(primaryProvider: Provider, region: string): Promise<Provider[]> {
    const backups: Provider[] = [];

    // Default backup strategy
    if (primaryProvider === Provider.plaid) {
      backups.push(Provider.mx, Provider.finicity);
    } else if (primaryProvider === Provider.belvo) {
      backups.push(Provider.mx);
    } else if (primaryProvider === Provider.mx) {
      if (region === 'MX') {
        backups.push(Provider.belvo);
      } else {
        backups.push(Provider.plaid, Provider.finicity);
      }
    }

    // Filter out providers with open circuit breakers
    const available: Provider[] = [];
    for (const provider of backups) {
      const isOpen = await this.circuitBreaker.isCircuitOpen(provider, region);
      if (!isOpen && this.providers.has(provider)) {
        available.push(provider);
      }
    }

    return available;
  }

  /**
   * Parse provider error into standardized ProviderError format
   *
   * Classifies errors by type and determines if they are retryable:
   * - auth: Credential issues (non-retryable)
   * - rate_limit: Too many requests (retryable)
   * - network: Connection issues (retryable)
   * - provider_down: Service unavailable (retryable)
   * - validation: Invalid request (non-retryable)
   *
   * @param error - Raw error from provider
   * @param provider - Provider that threw the error
   * @returns Standardized ProviderError object
   */
  private parseError(error: unknown, provider: Provider): ProviderError {
    const err = error as Record<string, unknown> | null;
    const errorMessage =
      (error instanceof Error ? error.message : String(error)) || 'Unknown error';

    // Determine error type and if it's retryable
    let type: ProviderError['type'] = 'unknown';
    let retryable = false;

    if (errorMessage.includes('auth') || errorMessage.includes('credentials')) {
      type = 'auth';
      retryable = false; // Auth errors require user intervention
    } else if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
      type = 'rate_limit';
      retryable = true;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      type = 'network';
      retryable = true;
    } else if (errorMessage.includes('unavailable') || errorMessage.includes('maintenance')) {
      type = 'provider_down';
      retryable = true;
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      type = 'validation';
      retryable = false;
    }

    return {
      code: (typeof err?.code === 'string' ? err.code : undefined) || 'UNKNOWN_ERROR',
      message: errorMessage,
      type,
      retryable,
      provider,
    };
  }

  /**
   * Log connection attempt for monitoring and analytics
   */
  private async logConnectionAttempt(params: {
    spaceId: string;
    accountId?: string;
    provider: Provider;
    institutionId?: string;
    attemptType: string;
    status: string;
    errorCode?: string;
    errorMessage?: string;
    responseTimeMs?: number;
    failoverUsed?: boolean;
    failoverProvider?: Provider;
  }): Promise<void> {
    try {
      await this.prisma.connectionAttempt.create({
        data: {
          spaceId: params.spaceId,
          accountId: params.accountId,
          provider: params.provider,
          institutionId: params.institutionId,
          attemptType: params.attemptType,
          status: params.status,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
          responseTimeMs: params.responseTimeMs,
          failoverUsed: params.failoverUsed || false,
          failoverProvider: params.failoverProvider,
        },
      });
    } catch (error) {
      // Don't fail the operation if logging fails
      this.logger.error(`Failed to log connection attempt: ${error}`);
    }
  }

  /**
   * Get provider health status for monitoring dashboard
   *
   * Returns health metrics for all providers in a region, including:
   * - Circuit breaker state (open/closed/half-open)
   * - Success/failure counts
   * - Average response times
   * - Last error messages
   *
   * @param region - Geographic region to get health for
   * @returns Array of provider health status records
   *
   * @example
   * ```typescript
   * const health = await orchestrator.getProviderHealth('US');
   * health.forEach(p => {
   *   console.log(`${p.provider}: ${p.status}, circuit: ${p.circuitBreakerOpen ? 'OPEN' : 'CLOSED'}`);
   * });
   * ```
   */
  async getProviderHealth(region: string = 'US') {
    return await this.prisma.providerHealthStatus.findMany({
      where: { region },
      orderBy: { provider: 'asc' },
    });
  }

  /**
   * Get connection attempt history for an account
   */
  async getConnectionHistory(accountId: string, limit: number = 10) {
    return await this.prisma.connectionAttempt.findMany({
      where: { accountId },
      orderBy: { attemptedAt: 'desc' },
      take: limit,
    });
  }
}
