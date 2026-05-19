import {
  withRetry,
  withRetryResult,
  withBatchRetry,
  RETRY_PRESETS,
} from '../../core/utils/retry.util';

import { createFailingOperation, createNetworkError } from './helpers/chaos-utils';

describe('Retry Backoff Chaos Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Successful retry on Nth attempt', () => {
    it('succeeds on 3rd attempt', async () => {
      const op = createFailingOperation(2, 'success');

      const result = await withRetryResult(op, {
        maxRetries: 3,
        baseDelayMs: 10,
        jitter: false,
        isRetryable: () => true,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
    });
  });

  describe('Exhausts all retries', () => {
    it('throws last error after all retries exhausted', async () => {
      const op = createFailingOperation(10, 'never');

      const result = await withRetryResult(op, {
        maxRetries: 3,
        baseDelayMs: 10,
        jitter: false,
        isRetryable: () => true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // initial attempt (0) + 3 retries = attempt counter ends at 4
      expect(result.attempts).toBe(4);
    });
  });

  describe('Exponential delay growth', () => {
    it('delays follow baseDelay * 2^(attempt-1) pattern', async () => {
      const delays: number[] = [];
      const op = createFailingOperation(3, 'ok');

      await withRetry(op, {
        maxRetries: 3,
        baseDelayMs: 100,
        jitter: false,
        isRetryable: () => true,
        onRetry: (_attempt, _error, nextDelayMs) => {
          delays.push(nextDelayMs);
        },
      });

      // attempt=1: 100 * 2^0 = 100
      // attempt=2: 100 * 2^1 = 200
      // attempt=3: 100 * 2^2 = 400
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);
      expect(delays[2]).toBe(400);
    });

    it('caps delay at maxDelayMs', async () => {
      const delays: number[] = [];
      const op = createFailingOperation(5, 'ok');

      await withRetry(op, {
        maxRetries: 5,
        baseDelayMs: 100,
        maxDelayMs: 300,
        jitter: false,
        isRetryable: () => true,
        onRetry: (_attempt, _error, nextDelayMs) => {
          delays.push(nextDelayMs);
        },
      });

      for (const delay of delays) {
        expect(delay).toBeLessThanOrEqual(300);
      }
    });

    it('adds jitter within bounds', async () => {
      const delays: number[] = [];

      // Run multiple times to get a statistical sample
      for (let i = 0; i < 5; i++) {
        const failOp = createFailingOperation(1, 'ok');
        await withRetry(failOp, {
          maxRetries: 1,
          baseDelayMs: 1000,
          jitter: true,
          jitterFactor: 0.2,
          isRetryable: () => true,
          onRetry: (_attempt, _error, nextDelayMs) => {
            delays.push(nextDelayMs);
          },
        });
      }

      // Jitter factor 0.2 on base 1000 means delay in [800, 1200]
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(800);
        expect(delay).toBeLessThanOrEqual(1200);
      }
    });
  });

  describe('Non-retryable errors stop immediately', () => {
    it('stops on non-retryable error (400 status)', async () => {
      let attempts = 0;
      const op = async () => {
        attempts++;
        const error = new Error('Validation failed');
        (error as any).status = 400;
        throw error;
      };

      const result = await withRetryResult(op, {
        maxRetries: 5,
        baseDelayMs: 10,
      });

      expect(result.success).toBe(false);
      expect(attempts).toBe(1);
    });

    it('uses custom isRetryable predicate', async () => {
      let attempts = 0;
      const op = async () => {
        attempts++;
        throw new Error('Custom non-retryable');
      };

      const result = await withRetryResult(op, {
        maxRetries: 5,
        baseDelayMs: 10,
        isRetryable: () => false,
      });

      expect(result.success).toBe(false);
      expect(attempts).toBe(1);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('cancels mid-retry when signal aborted', async () => {
      const controller = new AbortController();
      let attempts = 0;

      const op = async () => {
        attempts++;
        if (attempts === 2) {
          controller.abort();
        }
        throw createNetworkError('ECONNRESET');
      };

      const result = await withRetryResult(op, {
        maxRetries: 5,
        baseDelayMs: 10,
        jitter: false,
        signal: controller.signal,
      });

      expect(result.success).toBe(false);
      // The abort is detected either via sleep rejection or the signal check at loop top
      expect(result.error).toBeDefined();
    });
  });

  describe('Preset configs', () => {
    it('provider_sync has 5 retries and 2s base', () => {
      const preset = RETRY_PRESETS['provider_sync'];
      expect(preset.maxRetries).toBe(5);
      expect(preset.baseDelayMs).toBe(2000);
    });

    it('webhook_delivery has 3 retries and 500ms base', () => {
      const preset = RETRY_PRESETS['webhook_delivery'];
      expect(preset.maxRetries).toBe(3);
      expect(preset.baseDelayMs).toBe(500);
    });

    it('database has 3 retries and 100ms base', () => {
      const preset = RETRY_PRESETS['database'];
      expect(preset.maxRetries).toBe(3);
      expect(preset.baseDelayMs).toBe(100);
    });
  });

  describe('Batch retry', () => {
    it('handles partial failures in batch', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await withBatchRetry(
        items,
        async (item) => {
          if (item % 2 === 0) throw new Error(`Fail ${item}`);
          return item * 10;
        },
        { maxRetries: 0, baseDelayMs: 10 }
      );

      expect(results[0].result).toBe(10);
      expect(results[1].error).toBeDefined();
      expect(results[2].result).toBe(30);
      expect(results[3].error).toBeDefined();
      expect(results[4].result).toBe(50);
    });
  });

  describe('Network error retryability', () => {
    it.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'] as const)(
      'retries on %s network error',
      async (code) => {
        let attempts = 0;
        const op = async () => {
          attempts++;
          if (attempts < 3) throw createNetworkError(code);
          return 'recovered';
        };

        const result = await withRetry(op, {
          maxRetries: 3,
          baseDelayMs: 10,
          jitter: false,
        });

        expect(result).toBe('recovered');
        expect(attempts).toBe(3);
      }
    );
  });
});
