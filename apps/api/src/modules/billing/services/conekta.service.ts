/**
 * =============================================================================
 * Conekta Service (LATAM card + SPEI gateway)
 * =============================================================================
 * Handles payments for the Mexican market via Conekta's REST API:
 * - Credit/Debit Cards (MX issuers, 3DS supported)
 * - SPEI bank transfer orders
 * - OXXO cash vouchers (chargeable via order line items)
 *
 * Why a direct Conekta integration alongside the Janua-routed Conekta path?
 * - The existing `JanuaBillingService` proxies subscription lifecycle through
 *   Janua's unified billing API. This service is the *direct* card+SPEI charge
 *   path used by the ecosystem invoice flow (Cotiza → Dhanam invoices) where
 *   Janua-mediated subscription semantics don't apply.
 * - Future Wave A milestones (CFDI fan-out via Karafiel, MXN refund parity
 *   with Stripe MX) need the raw Conekta event stream, not Janua's
 *   normalized envelope.
 *
 * No actual Conekta API calls are made until `CONEKTA_PRIVATE_KEY` is provided
 * in the environment (operator runbook handles the rotation).
 *
 * Conekta API reference: https://developers.conekta.com/v2.1.0/reference
 * Webhook signature reference:
 *   https://developers.conekta.com/docs/webhooks-on-conekta#webhook-signature
 *
 * Credentials (from `dhanam-secrets` K8s Secret, see operator runbook
 * `internal-devops/runbooks/2026-04-25-wave-a-stripe-conekta-provisioning.md`):
 * - CONEKTA_PRIVATE_KEY        — HTTP Basic auth username (password is empty)
 * - CONEKTA_PUBLIC_KEY         — Client-side tokenization (Conekta.js)
 * - CONEKTA_WEBHOOK_SIGNING_KEY — HMAC-SHA256 secret for webhook verification
 * - CONEKTA_API_VERSION        — Defaults to "2.1.0"
 * =============================================================================
 */

import * as crypto from 'crypto';

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { BillingEventType, BillingStatus, Currency } from '@db';

import { AuditService } from '../../../core/audit/audit.service';
import { InfrastructureException } from '../../../core/exceptions/domain-exceptions';
import { PrismaService } from '../../../core/prisma/prisma.service';

import { PhyndCrmEngagementNotifierService } from './phyndcrm-engagement-notifier.service';
import type { DhanamPaymentEnvelope } from './stripe-mx-spei-relay.service';
import { WebhookDlqService } from './webhook-dlq.service';

/**
 * Subset of Conekta webhook event types we care about today.
 * Conekta emits ~40 event types; we only decode the four that drive
 * payment-status transitions in the Dhanam BillingEvent ledger.
 *
 * Full list: https://developers.conekta.com/docs/webhooks-on-conekta
 */
export type ConektaWebhookEventType =
  | 'charge.paid'
  | 'charge.declined'
  | 'charge.refunded'
  | 'order.expired'
  | string; // forward-compat: unknown types are logged + ack'd, never throw

export interface ConektaCreateChargeParams {
  /** Amount in cents/centavos. Conekta requires integer minor units. */
  amount: number;
  /** ISO-4217. Conekta natively supports 'MXN' and 'USD'. */
  currency: string;
  /** Customer info — required by Conekta even for one-shot charges. */
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  /**
   * Conekta payment source. For card: a tokenized id from Conekta.js
   * (`tok_xxx`). For SPEI: pass `{ type: 'spei' }`. For OXXO:
   * `{ type: 'oxxo_cash' }`.
   */
  paymentSource:
    | { type: 'card'; tokenId: string }
    | { type: 'spei' }
    | { type: 'oxxo_cash'; expiresAt?: number };
  /** Free-form metadata stored on the order. Surfaces in webhooks. */
  metadata?: Record<string, string>;
  /** Human description shown on receipts and in the Conekta dashboard. */
  description?: string;
}

export interface ConektaChargeResult {
  orderId: string;
  chargeId: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  /**
   * Present for SPEI/OXXO orders — the CLABE/reference + barcode info the
   * customer needs to complete the cash-out leg. Caller forwards to UI.
   */
  paymentInstructions?: {
    type: string;
    reference?: string;
    clabe?: string;
    bank?: string;
    barcodeUrl?: string;
    expiresAt?: number;
  };
}

export interface ConektaVerifiedEvent {
  id: string;
  type: ConektaWebhookEventType;
  livemode: boolean;
  createdAt: number;
  data: {
    object: Record<string, unknown>;
  };
}

export type ConektaWebhookClassification = 'paid' | 'declined' | 'refunded' | 'expired' | 'ignored';

export interface ConektaWebhookHandleResult {
  handled: boolean;
  classification: ConektaWebhookClassification;
  chargeId?: string;
  orderId?: string;
  idempotent?: boolean;
  relayed?: boolean;
  envelopeId?: string;
}

interface ConektaEventContext {
  chargeId?: string;
  orderId?: string;
  refundId?: string;
  amountMinor: number;
  currency: string;
  metadata: Record<string, string>;
  customerId?: string;
  customerEmail?: string;
  subscriptionId: string;
  failureReason?: string;
  failureCode?: string;
}

/**
 * Conekta gateway service.
 *
 * Mirrors the shape of `PaddleService` / `StripeMxService`:
 * - `isConfigured()` for graceful "no key, no boom" startup
 * - `createCharge()` for one-shot orders
 * - `verifyWebhookSignature()` returning a strongly-typed event
 *   (or throwing for invalid signatures — caller maps to BadRequest)
 * - `handleWebhookEvent()` for durable ledger writes + canonical
 *   payment.* fan-out (idempotency handled via `BillingEvent.stripeEventId`,
 *   the existing provider-event-id column shared with Stripe MX)
 */
@Injectable()
export class ConektaService {
  private readonly logger = new Logger(ConektaService.name);
  private readonly apiUrl = 'https://api.conekta.io';
  private readonly privateKey: string;
  private readonly publicKey: string;
  private readonly webhookSigningKey: string;
  private readonly apiVersion: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly phyndcrmNotifier: PhyndCrmEngagementNotifierService,
    private readonly dlq: WebhookDlqService
  ) {
    this.privateKey = this.config.get<string>('CONEKTA_PRIVATE_KEY', '');
    this.publicKey = this.config.get<string>('CONEKTA_PUBLIC_KEY', '');
    this.webhookSigningKey = this.config.get<string>('CONEKTA_WEBHOOK_SIGNING_KEY', '');
    this.apiVersion = this.config.get<string>('CONEKTA_API_VERSION', '2.1.0');

    if (!this.privateKey) {
      this.logger.warn(
        'CONEKTA_PRIVATE_KEY not configured — Conekta gateway disabled (operator must provision via Wave A runbook)'
      );
    } else {
      this.logger.log(`Conekta service initialized (API v${this.apiVersion})`);
    }
  }

  /**
   * Conekta is "configured" when we have a private key. Webhook verification
   * additionally requires the signing key but we don't gate `isConfigured()`
   * on it because outbound charges work without it (you just can't safely
   * accept inbound events).
   */
  isConfigured(): boolean {
    return !!this.privateKey;
  }

  /** Public key for Conekta.js client-side tokenization. */
  getPublicKey(): string {
    return this.publicKey;
  }

  /**
   * Create a Conekta order with a single line item + charge.
   *
   * Conekta's data model: an Order has line_items + charges + customer_info.
   * For our flows we always create amount-based single-charge orders (the
   * line_item is a synthetic "subscription/invoice" line — Conekta requires
   * at least one).
   *
   * Idempotency: Conekta supports an `Idempotency-Key` header. Caller is
   * responsible for supplying a stable id via metadata.idempotency_key (we
   * forward it to the header, not the order body).
   */
  async createCharge(params: ConektaCreateChargeParams): Promise<ConektaChargeResult> {
    if (!this.isConfigured()) {
      throw InfrastructureException.configurationError('CONEKTA_PRIVATE_KEY');
    }

    if (!Number.isInteger(params.amount) || params.amount <= 0) {
      throw InfrastructureException.configurationError(
        'Conekta charge amount must be a positive integer (minor units)'
      );
    }

    const currency = params.currency.toUpperCase();
    if (currency !== 'MXN' && currency !== 'USD') {
      throw InfrastructureException.configurationError(
        `Conekta charge currency must be MXN or USD (got "${params.currency}")`
      );
    }

    const orderBody: Record<string, unknown> = {
      currency,
      customer_info: {
        name: params.customerInfo.name,
        email: params.customerInfo.email,
        ...(params.customerInfo.phone ? { phone: params.customerInfo.phone } : {}),
      },
      line_items: [
        {
          name: params.description ?? 'Dhanam invoice',
          unit_price: params.amount,
          quantity: 1,
        },
      ],
      charges: [this.serializeChargeSource(params.paymentSource, params.amount)],
      metadata: params.metadata ?? {},
    };

    const headers = this.buildHeaders(params.metadata?.idempotency_key);

    try {
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/orders`, orderBody, { headers })
      );
      const order = response.data;
      const charge = order.charges?.data?.[0] ?? {};

      return {
        orderId: order.id,
        chargeId: charge.id,
        status: order.payment_status ?? charge.status ?? 'unknown',
        paymentStatus: charge.status ?? 'unknown',
        amount: order.amount,
        currency: order.currency,
        paymentInstructions: this.extractInstructions(charge),
      };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Conekta createCharge failed: ${message}`);
      throw InfrastructureException.externalServiceError('conekta', err as Error);
    }
  }

  /**
   * Verify a Conekta webhook signature.
   *
   * Conekta signs webhook bodies with HMAC-SHA256 using the webhook signing
   * key configured per endpoint. The signature is delivered in the
   * `digest` header as `sha256=<hex>`. Some legacy Conekta deployments use
   * the `conekta-signature` header — we accept both and prefer `digest`.
   *
   * Throws on:
   * - Missing/empty signature header
   * - Webhook signing key not configured (server misconfiguration)
   * - Signature mismatch
   * - Body parse failure (Conekta always sends JSON)
   *
   * The controller catches these and returns 400 (matching the
   * Stripe-MX/Janua/Paddle convention used elsewhere in this module —
   * see PR description for why we don't use 401).
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string): ConektaVerifiedEvent {
    if (!signatureHeader || signatureHeader.trim().length === 0) {
      throw new Error('Missing Conekta signature header');
    }

    if (!this.webhookSigningKey) {
      throw new Error('CONEKTA_WEBHOOK_SIGNING_KEY not configured');
    }

    if (!rawBody || rawBody.length === 0) {
      throw new Error('Empty webhook body');
    }

    const provided = this.parseSignatureHeader(signatureHeader);

    const expected = crypto
      .createHmac('sha256', this.webhookSigningKey)
      .update(rawBody, 'utf8')
      .digest('hex');

    // Length-check before timingSafeEqual — RangeError surfaces as a
    // confusing 500 if buffers differ in size.
    if (provided.length !== expected.length) {
      throw new Error('Conekta signature length mismatch');
    }

    const matches = crypto.timingSafeEqual(
      Buffer.from(provided, 'hex'),
      Buffer.from(expected, 'hex')
    );

    if (!matches) {
      throw new Error('Conekta signature verification failed');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch (err) {
      throw new Error(`Conekta webhook body is not valid JSON: ${(err as Error).message}`, {
        cause: err,
      });
    }

    return {
      id: String(parsed.id ?? ''),
      type: String(parsed.type ?? '') as ConektaWebhookEventType,
      livemode: Boolean(parsed.livemode),
      createdAt: Number(parsed.created_at ?? 0),
      data: (parsed.data as { object: Record<string, unknown> }) ?? { object: {} },
    };
  }

  /**
   * Dispatch a verified Conekta event to its handler.
   *
   * This path is intentionally aligned with the Stripe MX SPEI relay:
   * provider retries dedupe on event id, linked events land in
   * `BillingEvent`, canonical `payment.*` envelopes fan out to product
   * webhooks, and failed deliveries land in the DLQ for retry/replay.
   */
  async handleWebhookEvent(event: ConektaVerifiedEvent): Promise<ConektaWebhookHandleResult> {
    const context = this.extractEventContext(event);
    const { chargeId, orderId } = context;

    switch (event.type) {
      case 'charge.paid':
        this.logger.log(`Conekta charge.paid id=${chargeId} order=${orderId}`);
        return this.processPaymentEvent(event, 'paid', context);

      case 'charge.declined':
        this.logger.warn(`Conekta charge.declined id=${chargeId} order=${orderId}`);
        return this.processPaymentEvent(event, 'declined', context);

      case 'charge.refunded':
        this.logger.log(`Conekta charge.refunded id=${chargeId} order=${orderId}`);
        return this.processPaymentEvent(event, 'refunded', context);

      case 'order.expired':
        this.logger.log(`Conekta order.expired order=${orderId}`);
        return this.processPaymentEvent(event, 'expired', context);

      default:
        this.logger.log(`Conekta event ignored (no handler): type=${event.type} id=${event.id}`);
        return { handled: false, classification: 'ignored', chargeId, orderId };
    }
  }

  private async processPaymentEvent(
    event: ConektaVerifiedEvent,
    classification: Exclude<ConektaWebhookClassification, 'ignored'>,
    context: ConektaEventContext
  ): Promise<ConektaWebhookHandleResult> {
    const existing = await this.prisma.billingEvent.findFirst({
      where: { stripeEventId: event.id },
      select: { id: true },
    });
    if (existing) {
      this.logger.log(`Conekta event ${event.id} already processed (idempotent replay)`);
      return {
        handled: true,
        classification,
        chargeId: context.chargeId,
        orderId: context.orderId,
        idempotent: true,
        relayed: false,
      };
    }

    const envelope = await this.buildPaymentEnvelope(event, classification, context);
    if (!envelope) {
      return {
        handled: true,
        classification,
        chargeId: context.chargeId,
        orderId: context.orderId,
        relayed: false,
      };
    }

    await this.persistBillingEvent(event, classification, envelope);
    await this.dispatch(envelope);

    return {
      handled: true,
      classification,
      chargeId: context.chargeId,
      orderId: context.orderId,
      relayed: true,
      envelopeId: envelope.id,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async buildPaymentEnvelope(
    event: ConektaVerifiedEvent,
    classification: Exclude<ConektaWebhookClassification, 'ignored'>,
    context: ConektaEventContext
  ): Promise<DhanamPaymentEnvelope | null> {
    if (context.currency.toUpperCase() !== 'MXN') {
      this.logger.warn(
        `Dropping Conekta event ${event.id} — currency "${context.currency}" is not MXN`
      );
      return null;
    }

    const customerId = await this.resolveEnvelopeCustomerId(context);
    if (!customerId) {
      await this.audit.log({
        action: 'CONEKTA_RELAY_UNLINKED',
        severity: 'medium',
        metadata: {
          conekta_event_id: event.id,
          conekta_event_type: event.type,
          charge_id: context.chargeId,
          order_id: context.orderId,
        },
      });
      this.logger.warn(`Skipping Conekta ${event.type} ${event.id} — no customer_id resolved`);
      return null;
    }

    const amountMinor = Math.max(0, context.amountMinor);
    const type = this.envelopeTypeForClassification(classification);
    const paymentId =
      classification === 'refunded'
        ? context.refundId || event.id
        : context.chargeId || context.orderId || event.id;

    const envelope: DhanamPaymentEnvelope = {
      type,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        customer_id: customerId,
        subscription_id: context.subscriptionId,
        payment_id: paymentId,
        amount: (amountMinor / 100).toFixed(2),
        amount_minor: amountMinor,
        currency: 'MXN',
      },
    };

    if (type === 'payment.failed') {
      envelope.data.failure_reason =
        context.failureReason ||
        (classification === 'expired' ? 'Conekta order expired' : 'Conekta charge declined');
      envelope.data.failure_code =
        context.failureCode || (classification === 'expired' ? 'order.expired' : 'charge.declined');
    }

    if (type === 'payment.refunded') {
      envelope.data.refunded_payment_id = context.chargeId || context.orderId || event.id;
      envelope.data.original_payment_id = context.chargeId || context.orderId || event.id;
    }

    const ecosystem = this.extractEcosystemMetadata(context.metadata);
    if (ecosystem) {
      envelope.data.ecosystem = ecosystem;
    }

    return envelope;
  }

  private envelopeTypeForClassification(
    classification: Exclude<ConektaWebhookClassification, 'ignored'>
  ): DhanamPaymentEnvelope['type'] {
    if (classification === 'paid') return 'payment.succeeded';
    if (classification === 'refunded') return 'payment.refunded';
    return 'payment.failed';
  }

  private extractEventContext(event: ConektaVerifiedEvent): ConektaEventContext {
    const obj = (event.data?.object ?? {}) as Record<string, unknown>;
    const orderInfo = this.recordAt(obj, 'order_info');
    const order = this.recordAt(obj, 'order');
    const customerInfo =
      this.recordAt(obj, 'customer_info') ?? this.recordAt(orderInfo, 'customer_info');
    const paymentMethod = this.recordAt(obj, 'payment_method');
    const metadata = this.extractMetadata(obj, orderInfo, order);

    const chargeId = this.stringAt(obj, 'id') || this.stringAt(obj, 'charge_id');
    const orderId =
      this.stringAt(obj, 'order_id') ||
      this.stringAt(orderInfo, 'id') ||
      this.stringAt(order, 'id');
    const refund = this.recordAt(obj, 'refund') ?? this.firstRecordAt(obj, 'refunds', 'data');
    const refundId =
      this.stringAt(obj, 'refund_id') || this.stringAt(refund, 'id') || this.stringAt(obj, 'id');

    return {
      chargeId,
      orderId,
      refundId,
      amountMinor:
        this.numberAt(refund, 'amount') ??
        this.numberAt(obj, 'amount_refunded') ??
        this.numberAt(obj, 'amount') ??
        this.numberAt(orderInfo, 'amount') ??
        this.numberAt(order, 'amount') ??
        0,
      currency:
        this.stringAt(obj, 'currency') ||
        this.stringAt(orderInfo, 'currency') ||
        this.stringAt(order, 'currency') ||
        metadata.currency ||
        'MXN',
      metadata,
      customerId:
        metadata.dhanam_user_id ||
        metadata.user_id ||
        metadata.customer_id ||
        metadata.customerId ||
        metadata.janua_customer_id ||
        metadata.conekta_customer_id ||
        this.stringAt(obj, 'customer_id') ||
        this.stringAt(customerInfo, 'customer_id') ||
        this.stringAt(customerInfo, 'id'),
      customerEmail:
        metadata.customer_email ||
        metadata.email ||
        this.stringAt(customerInfo, 'email') ||
        this.stringAt(obj, 'customer_email'),
      subscriptionId:
        metadata.subscription_id ||
        metadata.janua_subscription_id ||
        metadata.conekta_subscription_id ||
        '',
      failureReason:
        this.stringAt(obj, 'failure_message') ||
        this.stringAt(obj, 'failure_reason') ||
        this.stringAt(paymentMethod, 'failure_message'),
      failureCode:
        this.stringAt(obj, 'failure_code') || this.stringAt(paymentMethod, 'failure_code'),
    };
  }

  private async persistBillingEvent(
    event: ConektaVerifiedEvent,
    classification: Exclude<ConektaWebhookClassification, 'ignored'>,
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
    if (!userId) {
      await this.audit.log({
        action: 'CONEKTA_RELAY_UNLINKED',
        severity: 'medium',
        metadata: {
          conekta_event_id: event.id,
          conekta_event_type: event.type,
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
          stripeEventId: event.id,
          metadata: {
            envelope_id: envelope.id,
            envelope_type: envelope.type,
            conekta_event_type: event.type,
            classification,
            payment_id: envelope.data.payment_id,
            subscription_id: envelope.data.subscription_id,
            source: 'conekta_direct_relay',
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `BillingEvent insert for conekta_event_id=${event.id} failed: ${(err as Error).message}`
      );
    }
  }

  private async dispatch(envelope: DhanamPaymentEnvelope): Promise<void> {
    void this.phyndcrmNotifier.notify(envelope);

    const targets = this.listRelayTargets();
    if (targets.length === 0) {
      this.logger.log(
        `No PRODUCT_WEBHOOK_URLS configured; Conekta envelope ${envelope.id} persisted only`
      );
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
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    await Promise.all(
      targets.map(async ({ product, url }) => {
        let statusCode: number | undefined;
        let errorMessage: string | undefined;
        let ok = false;

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
          if (!ok) {
            let responseBodySnippet = '';
            try {
              responseBodySnippet = (await res.text()).slice(0, 500);
            } catch {
              responseBodySnippet = '';
            }
            errorMessage = `consumer responded ${res.status}: ${responseBodySnippet}`;
            this.logger.warn(
              `Conekta relay to ${product} (${url}) returned ${res.status} for envelope ${envelope.id}`
            );
          } else {
            this.logger.log(`Relayed ${envelope.type} (${envelope.id}) → ${product}`);
          }
        } catch (err) {
          errorMessage = `network/timeout: ${(err as Error).message}`;
          this.logger.error(
            `Conekta relay to ${product} (${url}) failed: ${(err as Error).message}`
          );
        }

        if (!ok) {
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
              `Failed to persist DLQ row for ${product} Conekta envelope ${envelope.id}: ${
                (dlqErr as Error).message
              }`
            );
          }
        }
      })
    );
  }

  private async resolveEnvelopeCustomerId(context: ConektaEventContext): Promise<string | null> {
    const localUserId = await this.tryResolveLocalUserId(
      context.metadata.dhanam_user_id || context.metadata.user_id || context.customerId || ''
    );
    if (localUserId) return localUserId;
    return context.customerId || context.customerEmail || null;
  }

  private async tryResolveLocalUserId(candidate: string): Promise<string | null> {
    if (candidate) {
      const byId = await this.prisma.user.findUnique({
        where: { id: candidate },
        select: { id: true },
      });
      if (byId) return byId.id;

      const byJanuaCustomer = await this.prisma.user.findUnique({
        where: { januaCustomerId: candidate },
        select: { id: true },
      });
      if (byJanuaCustomer) return byJanuaCustomer.id;

      if (candidate.includes('@')) {
        const byEmail = await this.prisma.user.findUnique({
          where: { email: candidate },
          select: { id: true },
        });
        if (byEmail) return byEmail.id;
      }
    }

    return null;
  }

  private extractEcosystemMetadata(
    metadata: Record<string, string>
  ): DhanamPaymentEnvelope['data']['ecosystem'] | null {
    const keys = [
      'engagement_id',
      'cotiza_quote_id',
      'cotiza_quote_item_id',
      'milestone_id',
      'order_id',
      'source',
    ] as const;
    const picked: NonNullable<DhanamPaymentEnvelope['data']['ecosystem']> = {};
    for (const key of keys) {
      if (metadata[key]) {
        picked[key] = metadata[key];
      }
    }
    return Object.keys(picked).length > 0 ? picked : null;
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

  private buildHeaders(idempotencyKey?: string): Record<string, string> {
    const basicAuth = Buffer.from(`${this.privateKey}:`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${basicAuth}`,
      Accept: `application/vnd.conekta-v${this.apiVersion}+json`,
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    return headers;
  }

  private serializeChargeSource(
    source: ConektaCreateChargeParams['paymentSource'],
    amount: number
  ): Record<string, unknown> {
    if (source.type === 'card') {
      return {
        amount,
        payment_method: {
          type: 'card',
          token_id: source.tokenId,
        },
      };
    }
    if (source.type === 'spei') {
      return {
        amount,
        payment_method: {
          type: 'spei',
        },
      };
    }
    // oxxo_cash
    return {
      amount,
      payment_method: {
        type: 'oxxo_cash',
        ...(source.expiresAt ? { expires_at: source.expiresAt } : {}),
      },
    };
  }

  private extractInstructions(
    charge: Record<string, unknown>
  ): ConektaChargeResult['paymentInstructions'] | undefined {
    const pm = charge.payment_method as Record<string, unknown> | undefined;
    if (!pm) return undefined;

    const type = String(pm.type ?? '');
    if (type !== 'spei' && type !== 'oxxo_cash' && type !== 'banorte' && type !== 'cash') {
      return undefined;
    }

    return {
      type,
      reference: pm.reference as string | undefined,
      clabe: pm.clabe as string | undefined,
      bank: pm.bank as string | undefined,
      barcodeUrl: pm.barcode_url as string | undefined,
      expiresAt: pm.expires_at as number | undefined,
    };
  }

  /**
   * Conekta sends signatures in one of these forms:
   *   - `digest: sha256=<hex>`
   *   - `conekta-signature: t=<ts>,v1=<hex>` (newer accounts)
   *   - bare hex (rare; some test fixtures)
   *
   * We accept all three. The HMAC payload is the raw body either way; the
   * `t=` timestamp prefix is informational and not part of the signed
   * material per Conekta's signing-key model (vs. Stripe's t.body model).
   */
  private parseSignatureHeader(header: string): string {
    const trimmed = header.trim();

    // Form 1: "sha256=<hex>"
    if (trimmed.toLowerCase().startsWith('sha256=')) {
      return trimmed.slice('sha256='.length);
    }

    // Form 2: "t=...,v1=<hex>"
    if (trimmed.includes('v1=')) {
      const v1Part = trimmed.split(',').find((p) => p.trim().startsWith('v1='));
      if (!v1Part) {
        throw new Error('Conekta signature header missing v1= component');
      }
      return v1Part.trim().slice('v1='.length);
    }

    // Form 3: bare hex (validated by length check + timingSafeEqual upstream)
    if (/^[a-f0-9]+$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    throw new Error('Conekta signature header is not in a recognized format');
  }

  private extractMetadata(
    ...records: Array<Record<string, unknown> | undefined>
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const record of records) {
      const metadata = this.recordAt(record, 'metadata');
      if (!metadata) continue;
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string') {
          out[key] = value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          out[key] = String(value);
        }
      }
    }
    return out;
  }

  private recordAt(
    record: Record<string, unknown> | undefined,
    key: string
  ): Record<string, unknown> | undefined {
    const value = record?.[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private firstRecordAt(
    record: Record<string, unknown> | undefined,
    parentKey: string,
    childKey: string
  ): Record<string, unknown> | undefined {
    const parent = this.recordAt(record, parentKey);
    const child = parent?.[childKey];
    if (!Array.isArray(child)) return undefined;
    const first = child[0];
    return first && typeof first === 'object' && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : undefined;
  }

  private stringAt(record: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = record?.[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private numberAt(record: Record<string, unknown> | undefined, key: string): number | undefined {
    const value = record?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
}
