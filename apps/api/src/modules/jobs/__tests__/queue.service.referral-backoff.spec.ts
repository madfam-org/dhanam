import { QueueService } from '../queue.service';

/**
 * =============================================================================
 * Referral-rewards queue backoff schedule
 * =============================================================================
 * Asserts the audit-mandated 1m / 5m / 30m retry curve. BullMQ calls the
 * `backoffStrategy` with the 1-indexed upcoming attempt number (i.e.
 * `attemptsMade + 1` after a failure). With `attempts: 4` (initial + 3
 * retries) the strategy is queried with values 2, 3, and 4.
 *
 * The schedule is exposed as a static method so the worker registration
 * and these tests share the single source of truth.
 * =============================================================================
 */
describe('QueueService.referralRewardBackoff', () => {
  it('returns 1 minute before retry #2 (after the 1st failure)', () => {
    expect(QueueService.referralRewardBackoff(2)).toBe(60_000);
  });

  it('returns 5 minutes before retry #3 (after the 2nd failure)', () => {
    expect(QueueService.referralRewardBackoff(3)).toBe(5 * 60_000);
  });

  it('returns 30 minutes before retry #4 (after the 3rd failure)', () => {
    expect(QueueService.referralRewardBackoff(4)).toBe(30 * 60_000);
  });

  it('falls back to the 1-minute floor for the (unused) first-call branch', () => {
    // BullMQ does not call this with 1 in normal operation — defensive only.
    expect(QueueService.referralRewardBackoff(1)).toBe(60_000);
  });

  it('caps at 30 minutes for any defensive higher-attempt branch', () => {
    expect(QueueService.referralRewardBackoff(5)).toBe(30 * 60_000);
    expect(QueueService.referralRewardBackoff(99)).toBe(30 * 60_000);
  });
});
