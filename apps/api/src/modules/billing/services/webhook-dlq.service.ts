/**
 * =============================================================================
 * Webhook Dead-Letter Queue Service
 * =============================================================================
 *
 * Captures failed deliveries from the Dhanam → consumer webhook fan-out
 * (Stripe MX SPEI relay + subscription-lifecycle product webhooks) so an
 * auto-retry job (and an admin manual-replay endpoint) can re-deliver
 * them. Without this service, a transient Karafiel restart during a
 * `payment.succeeded` fan-out would silently drop the CFDI for that
 * customer.
 *
 * The service is intentionally narrow — it does NOT own the original
 * dispatch logic (that still lives in the relay services). Its only
 * jobs are:
 *
 *   1. `recordFailure()` — called by relay services on a non-2xx /
 *      timeout / network error. Persists a `WebhookDeliveryFailure`
 *      row and fires a Sentry event so operators see per-consumer
 *      failure rates.
 *   2. `replayDelivery()` — re-POSTs an existing failure row. Returns
 *      a structured result rather than throwing, so the cron job and
 *      the admin endpoint can both call it. Updates the row with the
 *      new attempt outcome.
 *   3. `findDueForRetry()` / `markResolved()` — lookup helpers for
 *      the cron job.
 *
 * ## Backoff schedule (hardcoded, no env knob)
 *
 * `next_retry_at = NOW() + (2 ^ attempt_count) minutes`, capped at
 * `MAX_ATTEMPTS = 10`. Schedule: 1, 2, 4, 8, 16, 32, 64, 128, 256, 512
 * minutes (~17h end-to-end). After 10 failed attempts the row is left
 * with `next_retry_at = null` and the auto-retry job stops touching
 * it — the operator can still trigger a manual replay via the
 * controller.
 *
 * ## Idempotency on the consumer side
 *
 * NOT this service's concern. Consumers (e.g. Karafiel) already key on
 * the envelope's `payment_id` for dedup. The DLQ retry just delivers;
 * if Karafiel has already issued the CFDI from a manual operator
 * action, it will return 200 OK and we mark resolved.
 *
 * =============================================================================
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { SentryService } from '../../../core/monitoring/sentry.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

/** Max delivery attempts (initial + retries). After this, manual only. */
export const WEBHOOK_DLQ_MAX_ATTEMPTS = 10;

/** Backoff base in minutes — minute * 2^attempt. */
const BACKOFF_BASE_MINUTES = 1;

/** What a relay service hands us when a delivery fails. */
export interface RecordFailureInput {
  /** Envelope id (the Dhanam-side correlation id). */
  eventId: string;
  /** Consumer key from PRODUCT_WEBHOOK_URLS, e.g. `karafiel`. */
  consumer: string;
  /** Full URL we POSTed to. */
  consumerUrl: string;
  /** Optional event type (`payment.succeeded`, etc.) for human filtering. */
  eventType?: string;
  /**
   * The exact body that was POSTed. Stored as the `payload` JSON
   * column so retries replay verbatim and the consumer's idempotency
   * key stays intact. Pass the parsed object — we serialize on retry.
   */
  payload: unknown;
  /**
   * The HMAC-SHA256 signature value sent with the original request
   * (the `X-Dhanam-Signature` header). Replayed verbatim — never
   * re-signed, because re-signing would defeat the consumer's
   * "have I seen this body before" dedup based on body+sig pair.
   */
  signatureHeader: string;
  /** Optional HTTP status code observed (omit for network/timeout errors). */
  statusCode?: number;
  /** Human-readable error string for the audit trail. */
  errorMessage: string;
}

/** Outcome of a single replay attempt. */
export interface ReplayResult {
  failureId: string;
  ok: boolean;
  statusCode?: number;
  errorMessage?: string;
  attemptCount: number;
  nextRetryAt: Date | null;
  resolvedAt: Date | null;
}

@Injectable()
export class WebhookDlqService {
  private readonly logger = new Logger(WebhookDlqService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    // SentryService is provided by the global MonitoringModule under the
    // string token 'SentryService' (matches the pattern used in
    // GlobalExceptionFilter). Optional so unit tests don't need to mock it.
    @Optional() @Inject('SentryService') private readonly sentry?: SentryService
  ) {}

  /**
   * Persist a failed delivery and emit a Sentry event for ops dashboards.
   *
   * Returns the persisted row so the caller can include the DLQ id in
   * its own log line if useful.
   */
  async recordFailure(input: RecordFailureInput) {
    const nextRetryAt = computeNextRetry(1);

    const row = await this.prisma.webhookDeliveryFailure.create({
      data: {
        eventId: input.eventId,
        consumer: input.consumer,
        consumerUrl: input.consumerUrl,
        eventType: input.eventType ?? null,
        payload: input.payload as never, // Prisma JSON
        signatureHeader: input.signatureHeader,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        lastStatusCode: input.statusCode ?? null,
        lastErrorMessage: truncateError(input.errorMessage),
        nextRetryAt,
      },
    });

    this.logger.warn(
      `DLQ recorded ${input.consumer} failure for event ${input.eventId}: ` +
        `status=${input.statusCode ?? 'network'} msg="${input.errorMessage}" ` +
        `next_retry=${nextRetryAt?.toISOString() ?? 'never'}`
    );

    this.sentry?.captureMessage(`Webhook delivery failed: ${input.consumer}`, 'warning', {
      event_id: input.eventId,
      consumer: input.consumer,
      consumer_url: input.consumerUrl,
      event_type: input.eventType,
      attempt: 1,
      status_code: input.statusCode,
      error_message: input.errorMessage,
      dlq_id: row.id,
    });

    return row;
  }

  /**
   * Re-POST a single failed delivery and update its bookkeeping.
   *
   * `force` resets `attemptCount` to a fresh attempt — used by the
   * manual-replay endpoint where an operator is explicitly retrying.
   *
   * Never throws; downstream HTTP errors are captured into the row
   * and surfaced via the returned `ReplayResult`. Throwing here would
   * crash the cron job mid-batch.
   */
  async replayDelivery(failureId: string, opts: { force?: boolean } = {}): Promise<ReplayResult> {
    const row = await this.prisma.webhookDeliveryFailure.findUnique({
      where: { id: failureId },
    });
    if (!row) {
      throw new Error(`webhook_delivery_failure ${failureId} not found`);
    }

    if (row.resolvedAt && !opts.force) {
      // Already resolved — caller should have filtered, but if not,
      // surface a clean no-op.
      return {
        failureId: row.id,
        ok: true,
        attemptCount: row.attemptCount,
        nextRetryAt: row.nextRetryAt,
        resolvedAt: row.resolvedAt,
      };
    }

    const attempt = opts.force ? 1 : row.attemptCount + 1;
    const body = JSON.stringify(row.payload);

    let statusCode: number | undefined;
    let errorMessage: string | undefined;
    let ok: boolean;

    try {
      const res = await fetch(row.consumerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dhanam-Signature': row.signatureHeader,
          'X-Dhanam-Envelope-Id': row.eventId,
          'X-Dhanam-Event-Type': row.eventType ?? '',
          'X-Dhanam-Replay': 'true',
          'X-Dhanam-Replay-Attempt': String(attempt),
        },
        body,
      });
      statusCode = res.status;
      ok = res.ok;
      if (!ok) {
        try {
          // Capture a short tail of the response body for triage.
          const text = await res.text();
          errorMessage = `consumer responded ${res.status}: ${text.slice(0, 500)}`;
        } catch {
          errorMessage = `consumer responded ${res.status}`;
        }
      }
    } catch (err) {
      statusCode = undefined;
      errorMessage = `network/timeout: ${(err as Error).message}`;
      ok = false;
    }

    const now = new Date();

    if (ok) {
      const updated = await this.prisma.webhookDeliveryFailure.update({
        where: { id: row.id },
        data: {
          attemptCount: attempt,
          lastAttemptAt: now,
          lastStatusCode: statusCode ?? null,
          lastErrorMessage: null,
          nextRetryAt: null,
          resolvedAt: now,
        },
      });
      this.logger.log(
        `DLQ replay OK: ${row.consumer} event ${row.eventId} resolved on attempt ${attempt}`
      );
      return {
        failureId: updated.id,
        ok: true,
        statusCode,
        attemptCount: updated.attemptCount,
        nextRetryAt: updated.nextRetryAt,
        resolvedAt: updated.resolvedAt,
      };
    }

    // Failed retry — update bookkeeping + schedule (or stop) next attempt.
    const exhausted = attempt >= WEBHOOK_DLQ_MAX_ATTEMPTS;
    const nextRetryAt = exhausted ? null : computeNextRetry(attempt);

    const updated = await this.prisma.webhookDeliveryFailure.update({
      where: { id: row.id },
      data: {
        attemptCount: attempt,
        lastAttemptAt: now,
        lastStatusCode: statusCode ?? null,
        lastErrorMessage: truncateError(errorMessage ?? 'unknown'),
        nextRetryAt,
      },
    });

    this.logger.warn(
      `DLQ replay FAIL: ${row.consumer} event ${row.eventId} attempt ${attempt}/${WEBHOOK_DLQ_MAX_ATTEMPTS} ` +
        `status=${statusCode ?? 'network'} next_retry=${nextRetryAt?.toISOString() ?? 'EXHAUSTED'}`
    );

    this.sentry?.captureMessage(
      `Webhook delivery failed: ${row.consumer}`,
      exhausted ? 'error' : 'warning',
      {
        event_id: row.eventId,
        consumer: row.consumer,
        consumer_url: row.consumerUrl,
        event_type: row.eventType,
        attempt,
        max_attempts: WEBHOOK_DLQ_MAX_ATTEMPTS,
        status_code: statusCode,
        error_message: errorMessage,
        dlq_id: row.id,
        exhausted,
      }
    );

    return {
      failureId: updated.id,
      ok: false,
      statusCode,
      errorMessage,
      attemptCount: updated.attemptCount,
      nextRetryAt: updated.nextRetryAt,
      resolvedAt: updated.resolvedAt,
    };
  }

  /**
   * List unresolved rows whose `next_retry_at` is now or in the past.
   * Used by the cron job. Bounded by `limit` so a single tick can't
   * stall the scheduler.
   */
  async findDueForRetry(limit = 50, now: Date = new Date()) {
    return this.prisma.webhookDeliveryFailure.findMany({
      where: {
        resolvedAt: null,
        nextRetryAt: { lte: now },
        attemptCount: { lt: WEBHOOK_DLQ_MAX_ATTEMPTS },
      },
      orderBy: { nextRetryAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Mark a failure resolved without replaying (operator handled
   * out-of-band — e.g. manually issued the CFDI in Karafiel).
   */
  async markResolved(failureId: string, opts: { reason?: string } = {}) {
    return this.prisma.webhookDeliveryFailure.update({
      where: { id: failureId },
      data: {
        resolvedAt: new Date(),
        nextRetryAt: null,
        lastErrorMessage: opts.reason
          ? truncateError(`manually resolved: ${opts.reason}`)
          : 'manually resolved',
      },
    });
  }

  /**
   * Paginated list for the admin UI. Filter on consumer + since
   * (createdAt) + resolved status.
   */
  async listFailures(opts: {
    consumer?: string;
    since?: Date;
    includeResolved?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (opts.consumer) where.consumer = opts.consumer;
    if (opts.since) where.createdAt = { gte: opts.since };
    if (!opts.includeResolved) where.resolvedAt = null;

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      this.prisma.webhookDeliveryFailure.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.webhookDeliveryFailure.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  /**
   * True when the auto-retry cron job should run. Defaults to enabled
   * in production, disabled elsewhere — explicit env override allowed.
   * Set `WEBHOOK_DLQ_AUTO_RETRY_ENABLED=true` (or `=1`) to force on,
   * or `false`/`0` to force off.
   */
  isAutoRetryEnabled(): boolean {
    const raw = this.config.get<string>('WEBHOOK_DLQ_AUTO_RETRY_ENABLED');
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    // Default: on in production, off everywhere else (keeps tests + dev
    // from accidentally hammering real consumers).
    return this.config.get<string>('NODE_ENV') === 'production';
  }
}

/** Exponential backoff: minutes = 2 ^ attempt (1, 2, 4, …, 512). */
export function computeNextRetry(attemptCount: number, now: Date = new Date()): Date {
  const minutes = BACKOFF_BASE_MINUTES * Math.pow(2, attemptCount);
  return new Date(now.getTime() + minutes * 60 * 1000);
}

/**
 * Errors from arbitrary HTTP responses can be enormous (full HTML
 * pages from a misconfigured load balancer, etc). Cap at 2KB so the
 * row stays manageable in the admin UI.
 */
function truncateError(s: string): string {
  return s.length > 2048 ? `${s.slice(0, 2045)}...` : s;
}
