/**
 * PhyndCRM engagement event notifier — outbound from Dhanam.
 *
 * When a Stripe MX payment envelope carries ecosystem metadata tying it
 * to a PhyndCRM engagement, fire a `dhanam:payment.succeeded` (or
 * failed/refunded) event to PhyndCRM's unified webhook so the client
 * portal timeline updates live. Fire-and-forget — PhyndCRM being
 * offline must never break the Stripe → Dhanam → Karafiel path.
 *
 * Design contract:
 * - Only fires when `envelope.data.ecosystem.engagement_id` is present.
 *   Standalone Dhanam-subscription payments (no engagement) are silent.
 * - Idempotent on PhyndCRM's side via a stable `dedup_key`:
 *   `dhanam:<type>:<payment_id>`. A retry of the same envelope is a
 *   no-op there.
 * - HMAC-SHA256 body signature via `PHYNE_ENGAGEMENT_EVENTS_SECRET`
 *   (same ecosystem-shared secret that Cotiza + Pravara use for the
 *   same endpoint).
 * - Errors logged, never thrown. Stripe's retry ladder still re-delivers
 *   to Dhanam if this ever matters.
 *
 * Endpoint: `POST <PHYNECRM_API_URL>/api/v1/engagements/events`
 */
import { createHmac } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DhanamPaymentEnvelope } from './stripe-mx-spei-relay.service';

export interface PhyneCrmEngagementEventPayload {
  engagement_id: string;
  source: 'dhanam';
  event_type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  status: 'completed' | 'failed';
  message: string;
  timestamp: string;
  dedup_key: string;
  metadata: Record<string, unknown>;
}

@Injectable()
export class PhyneCrmEngagementNotifierService {
  private readonly logger = new Logger(PhyneCrmEngagementNotifierService.name);
  private readonly apiUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = this.config.get<string>('PHYNECRM_API_URL', '');
    this.secret = this.config.get<string>('PHYNE_ENGAGEMENT_EVENTS_SECRET', '');
    this.timeoutMs = this.config.get<number>('PHYNECRM_WEBHOOK_TIMEOUT', 10_000);
  }

  /**
   * Emit a PhyndCRM engagement event for this envelope, if it carries
   * an engagement_id. Returns nothing — call-sites should `void` the
   * promise to make fire-and-forget explicit.
   */
  async notify(envelope: DhanamPaymentEnvelope): Promise<void> {
    const engagementId = envelope.data.ecosystem?.engagement_id;
    if (!engagementId) {
      // No engagement linked — nothing to do. This is the common path
      // for standalone Dhanam subs.
      return;
    }
    if (!this.apiUrl || !this.secret) {
      this.logger.warn(
        'PhyndCRM notify skipped — PHYNECRM_API_URL or PHYNE_ENGAGEMENT_EVENTS_SECRET not configured'
      );
      return;
    }

    const payload = this.buildPayload(envelope, engagementId);
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', this.secret).update(body).digest('hex');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.apiUrl.replace(/\/+$/, '')}/api/v1/engagements/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-timestamp': payload.timestamp,
        },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn(
          `PhyndCRM engagement notify returned ${res.status} for engagement=${engagementId} event=${payload.event_type}: ${text.slice(0, 200)}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `PhyndCRM engagement notify failed for engagement=${engagementId} event=${payload.event_type}: ${message}`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private buildPayload(
    envelope: DhanamPaymentEnvelope,
    engagementId: string
  ): PhyneCrmEngagementEventPayload {
    const { type, data, id: envelopeId, timestamp } = envelope;
    const eco = data.ecosystem ?? {};
    const human = describeEvent(envelope);
    return {
      engagement_id: engagementId,
      source: 'dhanam',
      event_type: type,
      status: type === 'payment.failed' ? 'failed' : 'completed',
      message: human,
      timestamp,
      // Stable per-payment dedup_key — PhyndCRM's `recordEvent`
      // short-circuits on the second delivery of the same key.
      dedup_key: `dhanam:${type}:${data.payment_id}`,
      metadata: {
        envelope_id: envelopeId,
        payment_id: data.payment_id,
        subscription_id: data.subscription_id || undefined,
        amount: data.amount,
        amount_minor: data.amount_minor,
        currency: data.currency,
        customer_id: data.customer_id,
        failure_reason: data.failure_reason,
        failure_code: data.failure_code,
        refunded_payment_id: data.refunded_payment_id,
        original_payment_id: data.original_payment_id,
        cotiza_quote_id: eco.cotiza_quote_id,
        cotiza_quote_item_id: eco.cotiza_quote_item_id,
        milestone_id: eco.milestone_id,
        order_id: eco.order_id,
        source_product: eco.source,
      },
    };
  }
}

function describeEvent(envelope: DhanamPaymentEnvelope): string {
  const { type, data } = envelope;
  const amt = `${data.amount} ${data.currency}`;
  switch (type) {
    case 'payment.succeeded':
      return `Payment received: ${amt}`;
    case 'payment.failed':
      return data.failure_reason
        ? `Payment failed (${amt}): ${data.failure_reason}`
        : `Payment failed: ${amt}`;
    case 'payment.refunded':
      return `Refund issued: ${amt}`;
    default:
      return `Payment event: ${amt}`;
  }
}
