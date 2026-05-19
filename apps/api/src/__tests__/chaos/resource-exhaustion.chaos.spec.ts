import { withBatchRetry } from '../../core/utils/retry.util';
import { withTimeout, withParallelTimeouts, TimeoutError } from '../../core/utils/timeout.util';

import { createSlowOperation } from './helpers/chaos-utils';

describe('Resource Exhaustion Chaos Tests', () => {
  describe('Concurrent timeout independence', () => {
    it('each timeout operates independently', async () => {
      const results = await withParallelTimeouts([
        {
          operation: () => Promise.resolve('fast'),
          config: { timeoutMs: 100, operationName: 'fast' },
        },
        {
          operation: createSlowOperation(5000, 'slow'),
          config: { timeoutMs: 50, operationName: 'slow' },
        },
        {
          operation: () => Promise.resolve('also_fast'),
          config: { timeoutMs: 100, operationName: 'fast2' },
        },
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeInstanceOf(TimeoutError);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Batch retry under concurrency', () => {
    it('handles high concurrency without interference', async () => {
      const items = Array.from({ length: 20 }, (_, i) => i);
      let activeCount = 0;
      let maxActive = 0;

      const results = await withBatchRetry(
        items,
        async (item) => {
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          await new Promise((resolve) => setTimeout(resolve, 10));
          activeCount--;
          return item * 2;
        },
        { maxRetries: 0, concurrency: 5 }
      );

      // All should succeed
      expect(results.every((r) => r.result !== undefined)).toBe(true);
      // Concurrency should be respected
      expect(maxActive).toBeLessThanOrEqual(5);
    });
  });

  describe('Timeout cleanup', () => {
    it('clears timeout timer on successful completion', async () => {
      // This tests that timeouts don't leak. If they leaked,
      // the test would hang or show a warning about open handles.
      const result = await withTimeout(() => Promise.resolve('done'), {
        timeoutMs: 10000,
        operationName: 'cleanup_test',
      });
      expect(result).toBe('done');
    });
  });
});
