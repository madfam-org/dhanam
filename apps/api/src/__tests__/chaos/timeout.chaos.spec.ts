import {
  withTimeout,
  withTimeoutOrNull,
  withTimeoutOrDefault,
  withParallelTimeouts,
  withDeadlines,
  TimeoutError,
} from '../../core/utils/timeout.util';

import { createSlowOperation } from './helpers/chaos-utils';

describe('Timeout Chaos Tests', () => {
  describe('withTimeout', () => {
    it('returns result when operation completes within timeout', async () => {
      const result = await withTimeout(() => Promise.resolve('fast'), {
        timeoutMs: 1000,
        operationName: 'test',
      });
      expect(result).toBe('fast');
    });

    it('throws TimeoutError when operation exceeds timeout', async () => {
      await expect(
        withTimeout(createSlowOperation(5000, 'slow'), {
          timeoutMs: 50,
          operationName: 'slow_op',
        })
      ).rejects.toThrow(TimeoutError);
    });

    it('TimeoutError has correct properties', async () => {
      try {
        await withTimeout(createSlowOperation(5000), {
          timeoutMs: 50,
          operationName: 'test_op',
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).code).toBe('TIMEOUT');
        expect((error as TimeoutError).operationName).toBe('test_op');
        expect((error as TimeoutError).timeoutMs).toBe(50);
      }
    });

    it('calls onTimeout callback', async () => {
      const onTimeout = jest.fn();

      await expect(
        withTimeout(createSlowOperation(5000), {
          timeoutMs: 50,
          operationName: 'test',
          onTimeout,
        })
      ).rejects.toThrow(TimeoutError);

      expect(onTimeout).toHaveBeenCalled();
    });

    it('propagates non-timeout errors', async () => {
      const error = new Error('Custom error');

      await expect(
        withTimeout(() => Promise.reject(error), { timeoutMs: 1000, operationName: 'test' })
      ).rejects.toThrow('Custom error');
    });
  });

  describe('withTimeoutOrNull', () => {
    it('returns null on timeout', async () => {
      const result = await withTimeoutOrNull(createSlowOperation(5000), {
        timeoutMs: 50,
        operationName: 'test',
      });
      expect(result).toBeNull();
    });

    it('propagates non-timeout errors', async () => {
      await expect(
        withTimeoutOrNull(() => Promise.reject(new Error('Not timeout')), {
          timeoutMs: 1000,
          operationName: 'test',
        })
      ).rejects.toThrow('Not timeout');
    });
  });

  describe('withTimeoutOrDefault', () => {
    it('returns default value on timeout', async () => {
      const result = await withTimeoutOrDefault(createSlowOperation(5000), {
        timeoutMs: 50,
        operationName: 'test',
        defaultValue: 'fallback',
      });
      expect(result).toBe('fallback');
    });

    it('returns actual result when fast enough', async () => {
      const result = await withTimeoutOrDefault(() => Promise.resolve('actual'), {
        timeoutMs: 1000,
        operationName: 'test',
        defaultValue: 'fallback',
      });
      expect(result).toBe('actual');
    });
  });

  describe('withParallelTimeouts', () => {
    it('handles mixed success and timeout results', async () => {
      const results = await withParallelTimeouts([
        {
          operation: () => Promise.resolve('fast'),
          config: { timeoutMs: 1000, operationName: 'fast_op' },
        },
        {
          operation: createSlowOperation(5000, 'slow'),
          config: { timeoutMs: 50, operationName: 'slow_op' },
        },
        {
          operation: () => Promise.resolve('also_fast'),
          config: { timeoutMs: 1000, operationName: 'also_fast_op' },
        },
      ]);

      expect(results[0].success).toBe(true);
      expect(results[0].result).toBe('fast');
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeInstanceOf(TimeoutError);
      expect(results[2].success).toBe(true);
      expect(results[2].result).toBe('also_fast');
    });
  });

  describe('withDeadlines', () => {
    it('fires intermediate deadline callbacks before hard timeout', async () => {
      const warnCallback = jest.fn();
      const metricCallback = jest.fn();

      await expect(
        withDeadlines(createSlowOperation(5000), {
          deadlines: [
            { ms: 30, onDeadline: warnCallback },
            { ms: 60, onDeadline: metricCallback },
            { ms: 100 }, // hard timeout
          ],
          operationName: 'deadline_test',
        })
      ).rejects.toThrow(TimeoutError);

      // Intermediate callbacks should have fired before the hard timeout
      expect(warnCallback).toHaveBeenCalled();
      expect(metricCallback).toHaveBeenCalled();
    });

    it('clears deadline timers on success', async () => {
      const warnCallback = jest.fn();

      const result = await withDeadlines(() => Promise.resolve('fast'), {
        deadlines: [{ ms: 1000, onDeadline: warnCallback }, { ms: 5000 }],
        operationName: 'test',
      });

      expect(result).toBe('fast');
      // Wait a bit to verify callback is NOT called after cleanup
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(warnCallback).not.toHaveBeenCalled();
    });
  });
});
