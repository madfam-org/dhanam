/**
 * =============================================================================
 * Stripe Mexico SPEI / MXN Relay Service (T1.1 — MXN flywheel roadmap)
 * =============================================================================
 *
 * Bridges Stripe Mexico payment events (SPEI via `customer_balance`, card
 * MXN charges, refunds) into Dhanam's canonical outbound webhook envelope
 * so downstream consumers in the MADFAM ecosystem (Karafiel CFDI bridge,
 * PhyndCRM, analytics) receive a single, product-agnostic payment shape.
 *
 * On-wire envelope (MUST match Karafiel's `DhanamPaymentDataSerializer`
 * at `karafiel/apps/api/integrations/webhook_schemas.py`):
 *
 * ```json
 * {
 *   "type":      "payment.succeeded" | "payment.failed" | "payment.refunded",
 *   "id":        "<dhanam-generated UUID v4>",
 *   "timestamp": "2026-04-17T12:34:56.000Z",
 *   "data": {
 *     "customer_id":     "<dhanam user id, resolved from stripe metadata or customer map>",
 *     "subscription_id": "<stripe sub id if charge was subscription-driven>",
 *     "payment_id":      "<stripe PaymentIntent id — the CFDI idempotency key>",
 *     "amount":          "199.00",        // decimal MXN as string
 *     "amount_minor":    19900,           // integer centavos
 *     "currency":        "MXN",
 *     "failure_reason":  "...",           // payment.failed only
 *     "failure_code":    "...",           // payment.failed only
 *     "refunded_payment_id": "pi_...",    // payment.refunded only
 *     "original_payment_id": "pi_..."     // payment.refunded only, alias
 *   }
 * }
 * ```
 *
 * ## Scope
 *
 * This service handles ONLY the three Stripe event types needed for
 * Karafiel's CFDI bridge and Dhanam's own ledger:
 *
 * - `payment_intent.succeeded`   → `payment.succeeded`
 * - `payment_intent.payment_failed` → `payment.failed`
 * - `charge.refunded`             → `payment.refunded`
 *
 * Subscription / invoice events remain on the existing
 * `WebhookProcessorService` path — they already emit
 * `subscription.*` events via `notifyProductWebhooks`.
 *
 * ## Idempotency
 *
 * Stripe retries events with the SAME `event.id`. We dedup on
 * `BillingEvent.stripeEventId` (existing unique constraint) before
 * relaying. A replayed event is acknowledged 200 but no outbound
 * webhook is re-fired. This is the SETTLEMENT-FIRING rule from RFC
 * 0003 gotcha #2 — SPEI webhooks fire on settlement, never on
 * initiation, and we never double-fire on retry.
 *
 * ## Feature flag
 *
 * `FEATURE_STRIPE_MXN_LIVE` (default `false`) gates live-key access.
 * When off, the service still accepts + validates test-mode webhooks
 * so end-to-end flows can be exercised before flipping the flag.
 *
 * The flag is read against `StripeMxService.isConfigured()` and
 * against the `livemode` field on inbound Stripe events. A live-mode
 * event received while the flag is off is rejected with a logged
 * warning and a 200 ACK (never 500 — Stripe retries would be noise).
 *
 * ## Downstream dispatch
 *
 * Relay targets come from the existing `PRODUCT_WEBHOOK_URLS` env var
 * (shared with `SubscriptionLifecycleService.notifyProductWebhooks`).
 * HMAC-SHA256 signature using `DHANAM_WEBHOOK_SECRET`, header
 * `X-Dhanam-Signature`. We fan out to ALL configured products because a
 * PaymentIntent can settle without a `plan_id` metadata hint (customer
 * paid a standalone invoice), and downstream consumers are expected to
 * filter by customer_id.
 *
 * =============================================================================
 */

import { randomUUID, createHmac } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';

import { BillingEventType, BillingStatus, Currency, Prisma } from '@db';

import { AuditService } from '../../../core/audit/audit.service';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { parseKarafielCfdiUuid } from '../utils/karafiel-webhook-response';

import { PhyndCrmEngagementNotifierService } from './phyndcrm-engagement-notifier.service';
import { WebhookDlqService } from './webhook-dlq.service';

/** Outbound Dhanam envelope for payment.* events. */
export interface DhanamPaymentEnvelope {
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  id: string;
  timestamp: string;
  data: {
    customer_id: string;
    subscription_id: string;
    payment_id: string;
    amount: string;
    amount_minor: number;
    currency: 'MXN';
    failure_reason?: string;
    failure_code?: string;
    refunded_payment_id?: string;
    original_payment_id?: string;
    /**
     * Optional passthrough metadata from the Stripe PI. Callers upstream
     * (e.g. Cotiza's DhanamMilestoneService) stamp these onto the
     * PaymentIntent so downstream consumers can correlate back without
     * reaching into Stripe. Present when the payment is tied to a
     * cross-ecosystem flow; absent for standalone Dhanam subs.
     */
    ecosystem?: {
      engagement_id?: string;
      cotiza_quote_id?: string;
      cotiza_quote_item_id?: string;
      milestone_id?: string;
      order_id?: string;
      source?: 'cotiza' | 'routecraft' | string;
    };
  };
}

/**
 * Pull cross-ecosystem correlation keys out of Stripe metadata.
 *
 * Upstream producers (Cotiza's DhanamMilestoneService, RouteCraft's
 * checkout) stamp these onto the PaymentIntent so Dhanam consumers can
 * correlate back without a separate lookup. Present only when the
 * payment originated from a cross-ecosystem flow; returns `null` for a
 * standalone Dhanam subscription payment so the envelope stays lean.
 *
 * Keys recognized (all optional, all string):
 *   engagement_id             PhyndCRM engagement aggregate ID
 *   cotiza_quote_id           Cotiza quote ID (the parent quote)
 *   cotiza_quote_item_id      Cotiza quote-item ID (for per-milestone charges)
 *   milestone_id              The milestone inside services-mode details
 *   order_id                  Cotiza order ID (post-payment bundle)
 *   source                    Free-form tag — 'cotiza' | 'routecraft' | …
 */
export function extractEcosystemMetadata(
  metadata: Stripe.Metadata | null | undefined
): NonNullable<DhanamPaymentEnvelope['data']['ecosystem']> | null {
  if (!metadata) return null;
  const keys = [
    'engagement_id',
    'cotiza_quote_id',
    'cotiza_quote_item_id',
    'milestone_id',
    'order_id',
    'source',
  ] as const;
  const picked: Record<string, string> = {};
  for (const k of keys) {
    const v = metadata[k];
    if (typeof v === 'string' && v.length > 0) picked[k] = v;
  }
  return Object.keys(picked).length > 0 ? picked : null;
}

/** Stripe event types this relay recognizes. */
const SUPPORTED_STRIPE_EVENTS = new Set<string>([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
]);

/**
 * Currency codes accepted by the T1.1 MXN flywheel. SPEI is MXN-only;
 * non-MXN events are logged and dropped (they belong on the
 * global/Paddle path or on the legacy `invoice.*` route).
 */
const ALLOWED_CURRENCY = 'mxn';

@Injectable()
export class StripeMxSpeiRelayService {
  private readonly logger = new Logger(StripeMxSpeiRelayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly phyndcrmNotifier: PhyndCrmEngagementNotifierService,
    private readonly dlq: WebhookDlqService
  ) {}

  /**
   * True when the live-key path is enabled. Test-mode webhooks are
   * always accepted regardless of this flag — the flag only gates
   * LIVE-key acceptance + outbound dispatch.
   */
  isLiveModeEnabled(): boolean {
    const raw = this.config.get<string>('FEATURE_STRIPE_MXN_LIVE', 'false');
    return raw === 'true' || raw === '1';
  }

  /**
   * Entrypoint: called by the billing controller after Stripe signature
   * verification has succeeded. Returns true when an outbound envelope
   * was relayed, false when the event was intentionally skipped
   * (unsupported type, non-MXN currency, feature-flag off, idempotent
   * replay). Never throws on relay-side failure — downstream HTTP
   * errors are logged + swallowed so the Stripe webhook ACK stays 200
   * and Stripe's retry ladder doesn't amplify our outages.
   */
  async relay(event: Stripe.Event): Promise<boolean> {
    if (!SUPPORTED_STRIPE_EVENTS.has(event.type)) {
      this.logger.debug(`Skipping unsupported event type: ${event.type}`);
      return false;
    }

    // RFC 0003 Gotcha #5: live-key environment secret-scoped separately.
    // If Stripe's event is livemode but the operator hasn't flipped the
    // flag, we refuse to relay. Test-mode events always pass through.
    if (event.livemode && !this.isLiveModeEnabled()) {
      this.logger.warn(
        `Rejecting livemode Stripe event ${event.id} — FEATURE_STRIPE_MXN_LIVE is off`
      );
      return false;
    }

    // Idempotency: dedup on stripeEventId. The existing `BillingEvent`
    // table already has a unique index on that column and is the
    // canonical source of truth for "have we seen this before".
    const existing = await this.prisma.billingEvent.findFirst({
      where: { stripeEventId: event.id },
      select: { id: true },
    });
    if (existing) {
      this.logger.log(`Stripe event ${event.id} already processed (idempotent replay)`);
      return false;
    }

    let envelope: DhanamPaymentEnvelope | null;
    try {
      envelope = await this.buildEnvelope(event);
    } catch (err) {
      this.logger.error(
        `Failed to build Dhanam envelope for ${event.type} ${event.id}: ${(err as Error).message}`
      );
      return false;
    }

    if (!envelope) {
      // buildEnvelope returns null for intentional drops (non-MXN,
      // missing customer mapping, etc.) — already logged inside.
      return false;
    }

    await this.persistBillingEvent(event, envelope);
    await this.dispatch(envelope);
    return true;
  }

  // ─── envelope construction ───────────────────────────────────────────

  private async buildEnvelope(event: Stripe.Event): Promise<DhanamPaymentEnvelope | null> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return this.envelopeFromPaymentIntent(
          event.data.object as Stripe.PaymentIntent,
          'payment.succeeded'
        );
      case 'payment_intent.payment_failed':
        return this.envelopeFromPaymentIntent(
          event.data.object as Stripe.PaymentIntent,
          'payment.failed'
        );
      case 'charge.refunded':
        return this.envelopeFromCharge(event.data.object as Stripe.Charge);
      default:
        return null;
    }
  }

  private async envelopeFromPaymentIntent(
    pi: Stripe.PaymentIntent,
    type: 'payment.succeeded' | 'payment.failed'
  ): Promise<DhanamPaymentEnvelope | null> {
    if (!this.isMxnCurrency(pi.currency, pi.id)) return null;

    const customerId = await this.resolveDhanamUserId(pi.customer, pi.metadata);
    if (!customerId) {
      this.logger.warn(`Skipping ${type} for PI ${pi.id} — could not resolve dhanam customer_id`);
      return null;
    }

    const amountMinor = pi.amount ?? 0;
    const base: DhanamPaymentEnvelope = {
      type,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        customer_id: customerId,
        subscription_id: this.extractSubscriptionId(pi),
        payment_id: pi.id,
        amount: (amountMinor / 100).toFixed(2),
        amount_minor: amountMinor,
        currency: 'MXN',
      },
    };

    const ecosystem = extractEcosystemMetadata(pi.metadata);
    if (ecosystem) base.data.ecosystem = ecosystem;

    if (type === 'payment.failed' && pi.last_payment_error) {
      base.data.failure_reason = pi.last_payment_error.message || '';
      base.data.failure_code = pi.last_payment_error.code || '';
    }

    return base;
  }

  private async envelopeFromCharge(charge: Stripe.Charge): Promise<DhanamPaymentEnvelope | null> {
    if (!this.isMxnCurrency(charge.currency, charge.id)) return null;

    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id || '';

    const customerId = await this.resolveDhanamUserId(charge.customer, charge.metadata);
    if (!customerId) {
      this.logger.warn(
        `Skipping refund for charge ${charge.id} — could not resolve dhanam customer_id`
      );
      return null;
    }

    // `charge.refunded` fires once per refund event. Stripe carries the
    // most recent refund on `charge.refunds.data[0]` in event order;
    // fall back to `amount_refunded` if that list is empty (shouldn't
    // happen in a refund event, but defensive).
    const latestRefund = charge.refunds?.data?.[0];
    const amountMinor = latestRefund?.amount ?? charge.amount_refunded ?? 0;

    const envelope: DhanamPaymentEnvelope = {
      type: 'payment.refunded',
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        customer_id: customerId,
        subscription_id: this.extractSubscriptionIdFromCharge(charge),
        // For a refund the envelope's `payment_id` is the REFUND event's
        // own payment_id (used as the CFDI egreso idempotency key in
        // Karafiel). `refunded_payment_id`/`original_payment_id` point
        // at the original PI (used for original-CFDI UUID lookup).
        payment_id: latestRefund?.id || charge.id,
        amount: (amountMinor / 100).toFixed(2),
        amount_minor: amountMinor,
        currency: 'MXN',
        refunded_payment_id: paymentIntentId,
        original_payment_id: paymentIntentId,
      },
    };

    const ecosystem = extractEcosystemMetadata(charge.metadata);
    if (ecosystem) envelope.data.ecosystem = ecosystem;

    return envelope;
  }

  private isMxnCurrency(currency: string | null | undefined, id: string): boolean {
    if (!currency || currency.toLowerCase() !== ALLOWED_CURRENCY) {
      this.logger.warn(
        `Dropping event ${id} — currency "${currency}" is not MXN (Stripe MX relay is MXN-only)`
      );
      return false;
    }
    return true;
  }

  private extractSubscriptionId(pi: Stripe.PaymentIntent): string {
    const md = (pi.metadata ?? {}) as Record<string, string>;
    return md.subscription_id || md.stripe_subscription_id || '';
  }

  private extractSubscriptionIdFromCharge(charge: Stripe.Charge): string {
    const md = (charge.metadata ?? {}) as Record<string, string>;
    return md.subscription_id || md.stripe_subscription_id || '';
  }

  /**
   * Resolve a Dhanam user id for outbound `customer_id`. Preference order:
   *
   * 1. `metadata.dhanam_user_id` (set by our own checkout / PI creation)
   * 2. `User` row lookup by `stripeCustomerId`
   * 3. Stripe customer id itself (last-resort fallback for the
   *    zero-touch flow where the PI was created by a partner service)
   *
   * Returns empty string only if we'd otherwise emit a useless
   * customer_id (null / undefined); empty-string would fail
   * Karafiel's CharField required validation.
   */
  private async resolveDhanamUserId(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
    metadata: Stripe.Metadata | null | undefined
  ): Promise<string | null> {
    const md = (metadata ?? {}) as Record<string, string>;
    if (md.dhanam_user_id) return md.dhanam_user_id;

    const stripeCustomerId = typeof customer === 'string' ? customer : customer?.id;
    if (!stripeCustomerId) return null;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId },
      select: { id: true },
    });
    if (user) return user.id;

    // Last-resort: caller hadn't been federated yet. Karafiel's
    // `customer_id` serializer accepts any non-empty string and uses
    // it as the subscription lookup key, so returning the Stripe
    // customer id gives downstream a deterministic handle.
    return stripeCustomerId;
  }

  // ─── persistence ─────────────────────────────────────────────────────

  private async persistBillingEvent(
    stripeEvent: Stripe.Event,
    envelope: DhanamPaymentEnvelope
  ): Promise<void> {
    const typeMap: Record<DhanamPaymentEnvelope['type'], BillingEventType> = {
      'payment.succeeded': 'payment_succeeded' as BillingEventType,
      'payment.failed': 'payment_failed' as BillingEventType,
      'payment.refunded': 'refund_issued' as BillingEventType,
    };
    const statusMap: Record<DhanamPaymentEnvelope['type'], BillingStatus> = {
      'payment.succeeded': 'succeeded' as BillingStatus,
      'payment.failed': 'failed' as BillingStatus,
      'payment.refunded': 'succeeded' as BillingStatus,
    };

    const userId = await this.tryResolveLocalUserId(envelope.data.customer_id);

    // Some BillingEvent columns are required by the current schema —
    // where the caller is a non-Dhanam partner (userId unresolved) we
    // still want an audit trail of the relay, so we fall back to a
    // sentinel audit entry instead of a BillingEvent row.
    if (!userId) {
      await this.audit.log({
        action: 'STRIPE_MX_RELAY_UNLINKED',
        severity: 'medium',
        metadata: {
          stripe_event_id: stripeEvent.id,
          stripe_event_type: stripeEvent.type,
          envelope_id: envelope.id,
          envelope_type: envelope.type,
          customer_id: envelope.data.customer_id,
        },
      });
      return;
    }

    try {
      await this.prisma.billingEvent.create({
        data: {
          userId,
          type: typeMap[envelope.type],
          status: statusMap[envelope.type],
          amount: envelope.data.amount_minor / 100,
          currency: (envelope.data.currency as Currency) || 'MXN',
          stripeEventId: stripeEvent.id,
          metadata: {
            envelope_id: envelope.id,
            envelope_type: envelope.type,
            stripe_event_type: stripeEvent.type,
            payment_id: envelope.data.payment_id,
            subscription_id: envelope.data.subscription_id,
            source: 'stripe_mx_spei_relay',
          },
        },
      });
    } catch (err) {
      // Unique-constraint race: another replica beat us to the insert.
      // That's fine — idempotency honored, but we log for visibility.
      this.logger.warn(
        `BillingEvent insert for stripe_event_id=${stripeEvent.id} failed: ${
          (err as Error).message
        }`
      );
    }
  }

  private async tryResolveLocalUserId(customerId: string): Promise<string | null> {
    if (!customerId) return null;
    // customer_id may be a Dhanam user id OR a Stripe customer id
    // depending on the resolution path in resolveDhanamUserId.
    const byUserId = await this.prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (byUserId) return byUserId.id;
    const byStripeCustomer = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return byStripeCustomer?.id ?? null;
  }

  // ─── outbound dispatch ───────────────────────────────────────────────

  /**
   * Fan out the envelope to all configured downstream product webhooks.
   *
   * URLs come from `PRODUCT_WEBHOOK_URLS` (shared env format with
   * `SubscriptionLifecycleService.notifyProductWebhooks`). A payment
   * event has no `plan_id` to route on, so we fan out to every
   * configured product and let the consumer filter by `customer_id`.
   *
   * Retries are intentionally the responsibility of the consumer.
   * We deliver best-effort, log failures, and leave Stripe's own
   * retry ladder to re-deliver to us if we returned non-200.
   */
  private async dispatch(envelope: DhanamPaymentEnvelope): Promise<void> {
    // Fire the PhyndCRM engagement event first (fire-and-forget). It's
    // schema-incompatible with the `PRODUCT_WEBHOOK_URLS` canonical
    // envelope so we can't add PhyndCRM as another target in that list
    // — it has its own transformer + endpoint.
    void this.phyndcrmNotifier.notify(envelope);

    const targets = this.listRelayTargets();
    if (targets.length === 0) {
      this.logger.log(`No PRODUCT_WEBHOOK_URLS configured; envelope ${envelope.id} persisted only`);
      return;
    }

    const secret = this.config.get<string>('DHANAM_WEBHOOK_SECRET', '');
    if (!secret) {
      this.logger.warn(
        'DHANAM_WEBHOOK_SECRET not configured — refusing to dispatch unsigned webhook'
      );
      return;
    }

    const body = JSON.stringify(envelope);
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    await Promise.all(
      targets.map(async ({ product, url }) => {
        let statusCode: number | undefined;
        let errorMessage: string | undefined;
        let ok = false;
        let responseBodySnippet: string;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Dhanam-Signature': signature,
              'X-Dhanam-Envelope-Id': envelope.id,
              'X-Dhanam-Event-Type': envelope.type,
            },
            body,
          });
          statusCode = res.status;
          ok = res.ok;
          try {
            responseBodySnippet = (await res.text()).slice(0, 2000);
          } catch {
            responseBodySnippet = '';
          }
          if (!ok) {
            errorMessage = `consumer responded ${res.status}: ${responseBodySnippet.slice(0, 500)}`;
            this.logger.warn(
              `Relay to ${product} (${url}) returned ${res.status} for envelope ${envelope.id}`
            );
          } else {
            this.logger.log(`Relayed ${envelope.type} (${envelope.id}) → ${product}`);
            if (product === 'karafiel') {
              await this.recordKarafielCfdiOnTimeline(
                envelope.data.payment_id,
                parseKarafielCfdiUuid(responseBodySnippet)
              );
            }
          }
        } catch (err) {
          errorMessage = `network/timeout: ${(err as Error).message}`;
          this.logger.error(`Relay to ${product} (${url}) failed: ${(err as Error).message}`);
        }

        if (!ok) {
          // Persist to the DLQ so the auto-retry job (and the manual
          // replay endpoint) can deliver later. Best-effort: a DLQ
          // insertion failure must not amplify into a Stripe retry.
          try {
            await this.dlq.recordFailure({
              eventId: envelope.id,
              consumer: product,
              consumerUrl: url,
              eventType: envelope.type,
              payload: envelope,
              signatureHeader: signature,
              statusCode,
              errorMessage: errorMessage ?? 'unknown',
            });
          } catch (dlqErr) {
            this.logger.error(
              `Failed to persist DLQ row for ${product} envelope ${envelope.id}: ${
                (dlqErr as Error).message
              }`
            );
          }
        }
      })
    );
  }

  private async recordKarafielCfdiOnTimeline(
    paymentId: string,
    cfdiUuid: string | null
  ): Promise<void> {
    if (!paymentId) {
      return;
    }

    const events = await this.prisma.billingEvent.findMany({
      where: {
        metadata: {
          path: ['paymentIntentId'],
          equals: paymentId,
        },
      },
      take: 25,
    });

    for (const event of events) {
      const existing = (event.metadata as Record<string, unknown> | null) ?? {};
      const mergedCfdi =
        cfdiUuid ?? (typeof existing.cfdiUuid === 'string' ? existing.cfdiUuid : null);
      await this.prisma.billingEvent.update({
        where: { id: event.id },
        data: {
          metadata: {
            ...existing,
            ...(mergedCfdi ? { cfdiUuid: mergedCfdi } : {}),
            karafielDelivered: true,
            karafielDeliveredAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  private listRelayTargets(): Array<{ product: string; url: string }> {
    const cfg = this.config.get<string>('PRODUCT_WEBHOOK_URLS', '') || '';
    const out: Array<{ product: string; url: string }> = [];
    for (const entry of cfg.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx <= 0) continue;
      const product = trimmed.slice(0, colonIdx).trim();
      const url = trimmed.slice(colonIdx + 1).trim();
      if (!product || !url) continue;
      out.push({ product, url });
    }
    return out;
  }
}
