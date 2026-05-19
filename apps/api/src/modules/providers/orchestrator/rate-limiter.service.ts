import { Injectable, Logger } from '@nestjs/common';

import { Provider } from '@db';

import { PrismaService } from '../../../core/prisma/prisma.service';

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  retryAfterMultiplier: number;
  maxRetries: number;
  maxBackoffMs: number;
}

interface RateLimitState {
  provider: Provider;
  region: string;
  requestsInMinute: number;
  requestsInHour: number;
  minuteWindowStart: Date;
  hourWindowStart: Date;
  backoffUntil: Date | null;
  consecutiveRetries: number;
}

/**
 * Rate Limiter Service
 *
 * Implements sliding window rate limiting with exponential backoff for
 * financial data provider API calls (Plaid, Belvo, MX, Finicity, Bitso).
 *
 * ## Rate Limiting Strategy
 * Uses a dual-window approach (minute + hour) to enforce both burst limits
 * and sustained throughput limits per provider.
 *
 * ## Provider-Specific Configurations
 * | Provider   | Req/Min | Req/Hour | Burst | Max Backoff |
 * |------------|---------|----------|-------|-------------|
 * | Plaid      | 100     | 3,000    | 20    | 5 min       |
 * | Belvo      | 60      | 1,000    | 10    | 5 min       |
 * | MX         | 60      | 1,000    | 10    | 5 min       |
 * | Finicity   | 50      | 1,000    | 10    | 5 min       |
 * | Bitso      | 30      | 500      | 5     | 10 min      |
 * | Blockchain | 30      | 1,000    | 5     | 5 min       |
 *
 * ## Backoff Algorithm
 * ```
 * backoff_ms = min(base_ms * 2^(retry-1), max_backoff)
 * backoff_ms += jitter (±10%)
 * ```
 *
 * ## State Management
 * - In-memory state for single-instance deployments
 * - Can be extended to Redis for multi-instance deployments
 * - State keyed by `provider:region` for geographic isolation
 *
 * @example
 * ```typescript
 * // Check if request is allowed
 * const { allowed, waitMs, reason } = await rateLimiter.canMakeRequest(Provider.plaid, 'US');
 * if (!allowed) {
 *   await sleep(waitMs);
 * }
 *
 * // Execute with automatic rate limiting and retry
 * const result = await rateLimiter.executeWithRateLimit(
 *   Provider.belvo,
 *   'MX',
 *   () => belvoClient.getAccounts()
 * );
 * ```
 *
 * @see ProviderOrchestratorService - Uses rate limiter for provider calls
 * @see CircuitBreakerService - Complementary pattern for failure handling
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // In-memory rate limit state (per-instance, could be Redis for multi-instance)
  private readonly rateLimitState = new Map<string, RateLimitState>();

  // Provider-specific rate limit configurations
  private readonly providerConfigs: Record<Provider, RateLimitConfig> = {
    belvo: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10,
      retryAfterMultiplier: 2,
      maxRetries: 5,
      maxBackoffMs: 5 * 60 * 1000, // 5 minutes max
    },
    plaid: {
      requestsPerMinute: 100,
      requestsPerHour: 3000,
      burstLimit: 20,
      retryAfterMultiplier: 2,
      maxRetries: 5,
      maxBackoffMs: 5 * 60 * 1000,
    },
    mx: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      burstLimit: 10,
      retryAfterMultiplier: 2,
      maxRetries: 5,
      maxBackoffMs: 5 * 60 * 1000,
    },
    finicity: {
      requestsPerMinute: 50,
      requestsPerHour: 1000,
      burstLimit: 10,
      retryAfterMultiplier: 2,
      maxRetries: 5,
      maxBackoffMs: 5 * 60 * 1000,
    },
    bitso: {
      requestsPerMinute: 30,
      requestsPerHour: 500,
      burstLimit: 5,
      retryAfterMultiplier: 2,
      maxRetries: 3,
      maxBackoffMs: 10 * 60 * 1000, // 10 minutes for crypto
    },
    blockchain: {
      requestsPerMinute: 30,
      requestsPerHour: 1000,
      burstLimit: 5,
      retryAfterMultiplier: 2,
      maxRetries: 5,
      maxBackoffMs: 5 * 60 * 1000,
    },
    manual: {
      requestsPerMinute: 1000,
      requestsPerHour: 10000,
      burstLimit: 100,
      retryAfterMultiplier: 1,
      maxRetries: 0,
      maxBackoffMs: 0,
    },
  };

  constructor(private prisma: PrismaService) {}

  /**
   * Check if a request can be made to a provider
   *
   * Evaluates current rate limit state against provider configuration.
   * Returns whether the request is allowed and how long to wait if not.
   *
   * @param provider - Financial data provider to check
   * @param region - Geographic region (affects rate tracking isolation)
   * @returns Object with allowed status, wait time in ms, and reason if blocked
   *
   * @example
   * ```typescript
   * const { allowed, waitMs, reason } = await rateLimiter.canMakeRequest(Provider.plaid, 'US');
   * if (!allowed) {
   *   console.log(`Rate limited: ${reason}. Retry in ${waitMs}ms`);
   * }
   * ```
   */
  async canMakeRequest(
    provider: Provider,
    region: string = 'US'
  ): Promise<{ allowed: boolean; waitMs: number; reason?: string }> {
    const state = this.getOrCreateState(provider, region);
    const config = this.providerConfigs[provider];
    const now = new Date();

    // Check if in backoff period
    if (state.backoffUntil && now < state.backoffUntil) {
      const waitMs = state.backoffUntil.getTime() - now.getTime();
      return {
        allowed: false,
        waitMs,
        reason: `Rate limit backoff in effect. Retry in ${Math.ceil(waitMs / 1000)}s`,
      };
    }

    // Reset windows if expired
    this.resetExpiredWindows(state, now);

    // Check minute limit
    if (state.requestsInMinute >= config.requestsPerMinute) {
      const waitMs = state.minuteWindowStart.getTime() + 60000 - now.getTime();
      return {
        allowed: false,
        waitMs: Math.max(0, waitMs),
        reason: `Minute rate limit reached (${config.requestsPerMinute}/min)`,
      };
    }

    // Check hour limit
    if (state.requestsInHour >= config.requestsPerHour) {
      const waitMs = state.hourWindowStart.getTime() + 3600000 - now.getTime();
      return {
        allowed: false,
        waitMs: Math.max(0, waitMs),
        reason: `Hour rate limit reached (${config.requestsPerHour}/hour)`,
      };
    }

    return { allowed: true, waitMs: 0 };
  }

  /**
   * Record a successful request to update rate limit counters
   *
   * Should be called immediately before executing a provider request.
   * Resets consecutive retry counter on successful recording.
   *
   * @param provider - Provider the request was made to
   * @param region - Geographic region for the request
   */
  async recordRequest(provider: Provider, region: string = 'US'): Promise<void> {
    const state = this.getOrCreateState(provider, region);
    const now = new Date();

    this.resetExpiredWindows(state, now);

    state.requestsInMinute++;
    state.requestsInHour++;
    state.consecutiveRetries = 0; // Reset retries on success
    state.backoffUntil = null;

    this.logger.debug(
      `Request recorded for ${provider}:${region}. ` +
        `Minute: ${state.requestsInMinute}, Hour: ${state.requestsInHour}`
    );
  }

  /**
   * Handle rate limit error with exponential backoff
   *
   * Calculates backoff duration using exponential algorithm with jitter:
   * `backoff = min(base * 2^(retry-1), max) ± 10% jitter`
   *
   * If server provides `Retry-After` header, uses that value instead.
   *
   * @param provider - Provider that returned rate limit error
   * @param region - Geographic region
   * @param retryAfterSeconds - Optional server-provided retry delay
   * @returns Whether to retry and how long to wait
   *
   * @example
   * ```typescript
   * try {
   *   await plaidClient.sync();
   * } catch (error) {
   *   if (error.status === 429) {
   *     const { shouldRetry, waitMs } = await rateLimiter.handleRateLimitError(
   *       Provider.plaid, 'US', error.headers['retry-after']
   *     );
   *     if (shouldRetry) await sleep(waitMs);
   *   }
   * }
   * ```
   */
  async handleRateLimitError(
    provider: Provider,
    region: string = 'US',
    retryAfterSeconds?: number
  ): Promise<{ shouldRetry: boolean; waitMs: number }> {
    const state = this.getOrCreateState(provider, region);
    const config = this.providerConfigs[provider];
    const now = new Date();

    state.consecutiveRetries++;

    // Check if max retries exceeded
    if (state.consecutiveRetries > config.maxRetries) {
      this.logger.warn(`Max retries (${config.maxRetries}) exceeded for ${provider}:${region}`);
      return { shouldRetry: false, waitMs: 0 };
    }

    // Calculate backoff time
    let backoffMs: number;
    if (retryAfterSeconds) {
      // Use server-provided retry-after
      backoffMs = retryAfterSeconds * 1000;
    } else {
      // Exponential backoff: base * 2^(attempts-1)
      const baseMs = 1000;
      backoffMs = Math.min(
        baseMs * Math.pow(config.retryAfterMultiplier, state.consecutiveRetries - 1),
        config.maxBackoffMs
      );
    }

    // Add jitter (±10%)
    const jitter = backoffMs * 0.1 * (Math.random() * 2 - 1);
    backoffMs = Math.round(backoffMs + jitter);

    state.backoffUntil = new Date(now.getTime() + backoffMs);

    this.logger.warn(
      `Rate limit hit for ${provider}:${region}. ` +
        `Retry ${state.consecutiveRetries}/${config.maxRetries}. ` +
        `Backing off for ${Math.ceil(backoffMs / 1000)}s`
    );

    // Update provider health status
    await this.updateProviderRateLimitStatus(provider, region, backoffMs);

    return { shouldRetry: true, waitMs: backoffMs };
  }

  /**
   * Get current rate limit status for monitoring dashboards
   *
   * Returns comprehensive state including current window counts, limits,
   * and any active backoff periods.
   *
   * @param provider - Provider to check status for
   * @param region - Geographic region
   * @returns Current rate limit state with limits and counters
   */
  async getRateLimitStatus(
    provider: Provider,
    region: string = 'US'
  ): Promise<{
    provider: Provider;
    region: string;
    requestsInMinute: number;
    requestsInHour: number;
    minuteLimit: number;
    hourLimit: number;
    isLimited: boolean;
    backoffUntil: Date | null;
    consecutiveRetries: number;
  }> {
    const state = this.getOrCreateState(provider, region);
    const config = this.providerConfigs[provider];
    const now = new Date();

    this.resetExpiredWindows(state, now);

    const isLimited = !!(
      (state.backoffUntil && now < state.backoffUntil) ||
      state.requestsInMinute >= config.requestsPerMinute ||
      state.requestsInHour >= config.requestsPerHour
    );

    return {
      provider,
      region,
      requestsInMinute: state.requestsInMinute,
      requestsInHour: state.requestsInHour,
      minuteLimit: config.requestsPerMinute,
      hourLimit: config.requestsPerHour,
      isLimited,
      backoffUntil: state.backoffUntil,
      consecutiveRetries: state.consecutiveRetries,
    };
  }

  /**
   * Get all providers' rate limit status
   */
  async getAllRateLimitStatus(): Promise<
    Array<Awaited<ReturnType<typeof this.getRateLimitStatus>>>
  > {
    const providers: Provider[] = ['belvo', 'plaid', 'mx', 'finicity', 'bitso', 'blockchain'];
    const statuses = await Promise.all(providers.map((p) => this.getRateLimitStatus(p)));
    return statuses;
  }

  /**
   * Reset rate limit state for a provider (admin/testing use)
   */
  async reset(provider: Provider, region: string = 'US'): Promise<void> {
    const key = `${provider}:${region}`;
    this.rateLimitState.delete(key);
    this.logger.log(`Rate limit state reset for ${provider}:${region}`);
  }

  /**
   * Execute a request with automatic rate limiting and retry
   *
   * Wraps provider calls with full rate limit handling:
   * 1. Checks if request is allowed (waits if necessary)
   * 2. Records the request attempt
   * 3. Executes the function
   * 4. Handles rate limit errors with exponential backoff
   * 5. Retries up to maxRetries times
   *
   * @param provider - Provider to execute request against
   * @param region - Geographic region for rate tracking
   * @param fn - Async function to execute (the actual provider call)
   * @returns Result of the provider call
   * @throws Error if max attempts exceeded or non-rate-limit error
   *
   * @example
   * ```typescript
   * const accounts = await rateLimiter.executeWithRateLimit(
   *   Provider.belvo,
   *   'MX',
   *   async () => {
   *     return belvoClient.getAccounts(connectionId);
   *   }
   * );
   * ```
   */
  async executeWithRateLimit<T>(
    provider: Provider,
    region: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const maxAttempts = this.providerConfigs[provider].maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Check rate limit
      const { allowed, waitMs, reason } = await this.canMakeRequest(provider, region);

      if (!allowed && waitMs > 0) {
        this.logger.debug(`Waiting ${waitMs}ms before request to ${provider}: ${reason}`);
        await this.sleep(waitMs);
      }

      try {
        await this.recordRequest(provider, region);
        const result = await fn();
        return result;
      } catch (error: unknown) {
        const isRateLimit = this.isRateLimitError(error);

        if (isRateLimit && attempt < maxAttempts) {
          const retryAfter = this.extractRetryAfter(error);
          const { shouldRetry, waitMs: backoffMs } = await this.handleRateLimitError(
            provider,
            region,
            retryAfter
          );

          if (shouldRetry) {
            this.logger.debug(`Retrying after ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`);
            await this.sleep(backoffMs);
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error(`Max attempts exceeded for ${provider}`);
  }

  private getOrCreateState(provider: Provider, region: string): RateLimitState {
    const key = `${provider}:${region}`;
    let state = this.rateLimitState.get(key);

    if (!state) {
      const now = new Date();
      state = {
        provider,
        region,
        requestsInMinute: 0,
        requestsInHour: 0,
        minuteWindowStart: now,
        hourWindowStart: now,
        backoffUntil: null,
        consecutiveRetries: 0,
      };
      this.rateLimitState.set(key, state);
    }

    return state;
  }

  private resetExpiredWindows(state: RateLimitState, now: Date): void {
    // Reset minute window
    if (now.getTime() - state.minuteWindowStart.getTime() > 60000) {
      state.requestsInMinute = 0;
      state.minuteWindowStart = now;
    }

    // Reset hour window
    if (now.getTime() - state.hourWindowStart.getTime() > 3600000) {
      state.requestsInHour = 0;
      state.hourWindowStart = now;
    }
  }

  private isRateLimitError(error: unknown): boolean {
    const err = error as Record<string, unknown> | null;
    const message = (err && typeof err.message === 'string' ? err.message : '').toLowerCase();
    const response = err?.response as Record<string, unknown> | undefined;
    const status = err?.status || err?.statusCode || response?.status;

    return (
      status === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('throttl')
    );
  }

  private extractRetryAfter(error: unknown): number | undefined {
    const err = error as Record<string, unknown> | null;
    const response = err?.response as Record<string, unknown> | undefined;
    const headers = response?.headers as Record<string, string> | undefined;
    if (headers) {
      const retryAfter = headers['retry-after'] || headers['Retry-After'];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds)) {
          return seconds;
        }
      }
    }
    return undefined;
  }

  private async updateProviderRateLimitStatus(
    provider: Provider,
    region: string,
    backoffMs: number
  ): Promise<void> {
    try {
      await this.prisma.providerHealthStatus.upsert({
        where: {
          provider_region: { provider, region },
        },
        create: {
          provider,
          region,
          status: 'degraded',
          rateLimited: true,
          rateLimitResetAt: new Date(Date.now() + backoffMs),
        },
        update: {
          rateLimited: true,
          rateLimitResetAt: new Date(Date.now() + backoffMs),
          status: 'degraded',
        },
      });
    } catch (error) {
      this.logger.error('Failed to update provider rate limit status', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
