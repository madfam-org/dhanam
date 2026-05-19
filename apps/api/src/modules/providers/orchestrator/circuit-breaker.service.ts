import { PROVIDER_DEFAULTS } from '@dhanam/shared';
import { Injectable, Logger } from '@nestjs/common';

import { Provider } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { CircuitBreakerConfig, CircuitBreakerState } from './provider.interface';

/**
 * Circuit Breaker Service
 *
 * Implements the Circuit Breaker pattern to prevent cascading failures when
 * financial data providers become unavailable or unreliable.
 *
 * ## Circuit States
 * - **CLOSED**: Normal operation, requests pass through
 * - **OPEN**: Provider failing, requests fail fast without attempting
 * - **HALF-OPEN**: Testing if provider recovered, limited requests allowed
 *
 * ## State Transitions
 * ```
 * CLOSED --[failures >= threshold]--> OPEN
 * OPEN --[timeout elapsed]--> HALF-OPEN
 * HALF-OPEN --[success]--> CLOSED
 * HALF-OPEN --[failure]--> OPEN
 * ```
 *
 * ## Configuration
 * - `failureThreshold`: 5 failures to open circuit
 * - `successThreshold`: 2 successes to close circuit
 * - `timeout`: 60s before retrying after open
 * - `monitoringWindow`: 5min rolling window for failure counting
 *
 * @example
 * ```typescript
 * // Check if circuit is open before attempting operation
 * const isOpen = await circuitBreaker.isCircuitOpen(Provider.plaid, 'US');
 * if (isOpen) {
 *   return fallbackToBackupProvider();
 * }
 *
 * try {
 *   const result = await plaidService.sync();
 *   await circuitBreaker.recordSuccess(Provider.plaid, 'US', responseTime);
 * } catch (error) {
 *   await circuitBreaker.recordFailure(Provider.plaid, 'US', error.message);
 * }
 * ```
 *
 * @see ProviderOrchestratorService - Uses circuit breaker for failover decisions
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5, // Open after 5 failures
    successThreshold: 2, // Close after 2 successes
    timeout: PROVIDER_DEFAULTS.CIRCUIT_BREAKER_RETRY_MS, // Try again after 60 seconds
    monitoringWindow: 300000, // 5 minute rolling window
  };

  // Track consecutive successes in half-open state per provider+region
  private halfOpenSuccesses: Map<string, number> = new Map();

  // In-memory fallback cache when DB is unavailable
  private memoryCache: Map<string, { circuitBreakerOpen: boolean; updatedAt: Date }> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * Check if circuit is open for a provider
   *
   * When circuit is open, requests should fail fast without attempting
   * the actual operation. If timeout has passed, circuit moves to half-open
   * state to test recovery.
   *
   * @param provider - Provider to check circuit state for
   * @param region - Geographic region (circuits are tracked per provider+region)
   * @returns true if circuit is open (requests should not be attempted)
   */
  async isCircuitOpen(provider: Provider, region: string = 'US'): Promise<boolean> {
    const key = `${provider}:${region}`;

    let health: {
      circuitBreakerOpen: boolean;
      updatedAt: Date;
      errorRate: number;
      avgResponseTimeMs: number;
      consecutiveFailures: number;
    } | null;
    try {
      const record = await this.prisma.providerHealthStatus.findUnique({
        where: {
          provider_region: {
            provider,
            region,
          },
        },
      });

      // The Prisma `ProviderHealthStatus` model does not yet carry a
      // `consecutiveFailures` column (see schema.prisma — adding it requires
      // a coordinated migration). Default to 0 at read time so the rest of
      // the breaker logic stays type-safe without changing runtime behaviour.
      health = record
        ? {
            circuitBreakerOpen: record.circuitBreakerOpen,
            updatedAt: record.updatedAt,
            errorRate:
              typeof record.errorRate === 'number' ? record.errorRate : Number(record.errorRate),
            avgResponseTimeMs: record.avgResponseTimeMs,
            consecutiveFailures:
              (record as { consecutiveFailures?: number }).consecutiveFailures ?? 0,
          }
        : null;

      // Sync to memory cache
      if (health) {
        this.memoryCache.set(key, {
          circuitBreakerOpen: health.circuitBreakerOpen,
          updatedAt: health.updatedAt,
        });
      }
    } catch {
      // Fallback to in-memory cache when DB is unavailable
      this.logger.warn(`DB unavailable for circuit breaker check, using memory cache for ${key}`);
      const cached = this.memoryCache.get(key);
      if (!cached) return false;

      if (cached.circuitBreakerOpen) {
        const timeoutPassed = Date.now() - cached.updatedAt.getTime() > this.defaultConfig.timeout;
        return !timeoutPassed;
      }
      return false;
    }

    if (!health) {
      return false; // No health record = circuit closed
    }

    // If circuit breaker is explicitly open, check if timeout has passed
    if (health.circuitBreakerOpen) {
      const timeoutPassed = Date.now() - health.updatedAt.getTime() > this.defaultConfig.timeout;

      if (timeoutPassed) {
        // Move to half-open state
        this.logger.log(
          `Circuit breaker timeout passed for ${provider}. Moving to half-open state.`
        );
        await this.setHalfOpen(provider, region);
        return false; // Allow one attempt
      }

      return true; // Circuit still open
    }

    return false;
  }

  /**
   * Record a successful provider call
   *
   * Updates health metrics and closes the circuit if it was open/half-open.
   * Should be called after every successful provider operation.
   *
   * @param provider - Provider that succeeded
   * @param region - Geographic region
   * @param responseTimeMs - Response time for tracking performance
   */
  async recordSuccess(provider: Provider, region: string, responseTimeMs: number): Promise<void> {
    const now = new Date();
    const key = `${provider}:${region}`;

    // Check if circuit is in half-open state (circuitBreakerOpen but timeout passed)
    const health = await this.prisma.providerHealthStatus.findUnique({
      where: { provider_region: { provider, region } },
    });

    // Half-open: circuit breaker is still flagged open but status was set to 'degraded'
    // by setHalfOpen (called when timeout passes during isCircuitOpen check)
    const isHalfOpen = health?.circuitBreakerOpen && health?.status === 'degraded';

    let shouldClose = true;

    if (isHalfOpen) {
      // In half-open state, require successThreshold consecutive successes before closing
      const currentSuccesses = (this.halfOpenSuccesses.get(key) ?? 0) + 1;
      this.halfOpenSuccesses.set(key, currentSuccesses);

      if (currentSuccesses < this.defaultConfig.successThreshold) {
        shouldClose = false;
        this.logger.log(
          `Half-open success ${currentSuccesses}/${this.defaultConfig.successThreshold} for ${provider} in ${region}`
        );
      } else {
        this.halfOpenSuccesses.delete(key);
        this.logger.log(`Half-open threshold met for ${provider} in ${region}. Closing circuit.`);
      }
    } else {
      // Not in half-open state, clear any stale counter
      this.halfOpenSuccesses.delete(key);
    }

    await this.prisma.providerHealthStatus.upsert({
      where: {
        provider_region: {
          provider,
          region,
        },
      },
      create: {
        provider,
        region,
        status: 'healthy',
        successfulCalls: 1,
        failedCalls: 0,
        avgResponseTimeMs: responseTimeMs,
        lastSuccessAt: now,
        circuitBreakerOpen: false,
        windowStartAt: now,
      },
      update: {
        successfulCalls: { increment: 1 },
        lastSuccessAt: now,
        avgResponseTimeMs: responseTimeMs,
        status: shouldClose ? 'healthy' : 'degraded',
        circuitBreakerOpen: shouldClose ? false : true,
      },
    });

    this.logger.debug(`Recorded success for ${provider} in ${region}`);
  }

  /**
   * Record a failed provider call
   *
   * Increments failure counter and may open the circuit if threshold is reached.
   * The circuit opens when failures exceed threshold AND failure rate > 50%.
   *
   * @param provider - Provider that failed
   * @param region - Geographic region
   * @param error - Error message for logging
   * @param responseTimeMs - Optional response time before failure
   */
  async recordFailure(
    provider: Provider,
    region: string,
    error: string,
    responseTimeMs?: number
  ): Promise<void> {
    const now = new Date();

    const health = await this.prisma.providerHealthStatus.upsert({
      where: {
        provider_region: {
          provider,
          region,
        },
      },
      create: {
        provider,
        region,
        status: 'degraded',
        successfulCalls: 0,
        failedCalls: 1,
        avgResponseTimeMs: responseTimeMs || 0,
        lastFailureAt: now,
        lastError: error,
        circuitBreakerOpen: false,
        windowStartAt: now,
      },
      update: {
        failedCalls: { increment: 1 },
        lastFailureAt: now,
        lastError: error,
        status: 'degraded',
      },
    });

    // Check if we should open the circuit breaker
    const shouldOpen = await this.shouldOpenCircuit(health);

    if (shouldOpen) {
      await this.openCircuit(provider, region);
    }

    this.logger.warn(
      `Recorded failure for ${provider} in ${region}: ${error}. ` +
        `Failed calls: ${health.failedCalls + 1}`
    );
  }

  /**
   * Determine if circuit should open based on failure rate
   */
  private async shouldOpenCircuit(health: {
    id: string;
    windowStartAt: Date;
    failedCalls: number;
    successfulCalls: number;
  }): Promise<boolean> {
    const windowAge = Date.now() - health.windowStartAt.getTime();

    // Reset window if it's older than monitoring window
    if (windowAge > this.defaultConfig.monitoringWindow) {
      await this.prisma.providerHealthStatus.update({
        where: { id: health.id },
        data: {
          successfulCalls: 0,
          failedCalls: 0,
          windowStartAt: new Date(),
        },
      });
      return false;
    }

    // Open if failure threshold exceeded
    const totalCalls = health.successfulCalls + health.failedCalls + 1; // +1 for current failure
    const failureRate = totalCalls > 0 ? ((health.failedCalls + 1) / totalCalls) * 100 : 0;

    return health.failedCalls + 1 >= this.defaultConfig.failureThreshold && failureRate > 50;
  }

  /**
   * Open the circuit breaker for a provider
   */
  private async openCircuit(provider: Provider, region: string): Promise<void> {
    const key = `${provider}:${region}`;
    this.halfOpenSuccesses.delete(key);
    this.memoryCache.set(key, { circuitBreakerOpen: true, updatedAt: new Date() });

    await this.prisma.providerHealthStatus.update({
      where: {
        provider_region: {
          provider,
          region,
        },
      },
      data: {
        circuitBreakerOpen: true,
        status: 'down',
      },
    });

    this.logger.error(
      `🚨 Circuit breaker OPENED for ${provider} in ${region}. ` +
        `Provider marked as down. Will retry after ${this.defaultConfig.timeout}ms.`
    );
  }

  /**
   * Move circuit to half-open state (testing if provider recovered)
   */
  private async setHalfOpen(provider: Provider, region: string): Promise<void> {
    await this.prisma.providerHealthStatus.update({
      where: {
        provider_region: {
          provider,
          region,
        },
      },
      data: {
        status: 'degraded',
        // Don't fully close yet, wait for successful call
      },
    });

    this.logger.log(`Circuit breaker moved to HALF-OPEN for ${provider} in ${region}`);
  }

  /**
   * Get current circuit breaker state
   *
   * Returns detailed state information for monitoring dashboards.
   *
   * @param provider - Provider to get state for
   * @param region - Geographic region
   * @returns Circuit state with metrics (failures, successes, timestamps)
   *
   * @example
   * ```typescript
   * const state = await circuitBreaker.getState(Provider.plaid, 'US');
   * console.log(`Circuit: ${state.state}, Failures: ${state.failures}`);
   * if (state.nextAttemptAt) {
   *   console.log(`Will retry at: ${state.nextAttemptAt}`);
   * }
   * ```
   */
  async getState(provider: Provider, region: string): Promise<CircuitBreakerState> {
    const health = await this.prisma.providerHealthStatus.findUnique({
      where: {
        provider_region: {
          provider,
          region,
        },
      },
    });

    if (!health) {
      return {
        provider,
        region,
        state: 'closed',
        failures: 0,
        successes: 0,
      };
    }

    let state: 'closed' | 'open' | 'half-open' = 'closed';
    if (health.circuitBreakerOpen) {
      const timeoutPassed = Date.now() - health.updatedAt.getTime() > this.defaultConfig.timeout;
      state = timeoutPassed ? 'half-open' : 'open';
    }

    return {
      provider,
      region,
      state,
      failures: health.failedCalls,
      successes: health.successfulCalls,
      lastFailureAt: health.lastFailureAt || undefined,
      lastSuccessAt: health.lastSuccessAt || undefined,
      nextAttemptAt:
        state === 'open'
          ? new Date(health.updatedAt.getTime() + this.defaultConfig.timeout)
          : undefined,
    };
  }

  /**
   * Reset circuit breaker for a provider
   *
   * Manually closes the circuit and resets all counters.
   * Use for admin operations or testing purposes.
   *
   * @param provider - Provider to reset circuit for
   * @param region - Geographic region
   */
  async reset(provider: Provider, region: string): Promise<void> {
    this.halfOpenSuccesses.delete(`${provider}:${region}`);
    await this.prisma.providerHealthStatus.update({
      where: {
        provider_region: {
          provider,
          region,
        },
      },
      data: {
        circuitBreakerOpen: false,
        status: 'healthy',
        successfulCalls: 0,
        failedCalls: 0,
        errorRate: 0,
        windowStartAt: new Date(),
      },
    });

    this.logger.log(`Circuit breaker RESET for ${provider} in ${region}`);
  }
}
