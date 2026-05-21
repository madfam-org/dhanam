/**
 * =============================================================================
 * Conekta Controller (Wave A — LATAM card+SPEI gateway)
 * =============================================================================
 *
 * Webhook receiver for Conekta payment events. Sits alongside the
 * Stripe-MX webhook receiver (`/v1/billing/webhooks/stripe`) and the
 * Janua-routed webhook receiver (`/v1/billing/webhook/janua`).
 *
 * ## Endpoint
 *
 * - `POST /v1/billing/webhooks/conekta`
 *   Conekta webhook receiver. Signature-verified via
 *   `CONEKTA_WEBHOOK_SIGNING_KEY`. Returns 400 on invalid signature so
 *   Conekta retries; 200 on accepted (handler dispatch is fire-and-ack).
 *   THIS IS THE URL REGISTERED IN THE CONEKTA DASHBOARD.
 *
 * ## Why 400 instead of 401 for invalid signatures
 *
 * The user spec asked for 401, but every other webhook receiver in this
 * module (Stripe MX, Janua, Paddle) returns 400 via `BadRequestException`.
 * Matching the existing pattern keeps the alert/dashboard rules consistent
 * (a sudden burst of 401s would page on-call as if it were an auth problem
 * upstream). The intent of the spec — "must not 500" — is preserved.
 *
 * ## Idempotency
 *
 * Conekta delivers `event.id` (e.g. `evt_...`). `ConektaService` dedups via
 * the existing `BillingEvent.stripeEventId` unique constraint (the column is
 * mis-named — it is now the generic provider webhook event id), persists
 * linked payment events, emits canonical `payment.*` envelopes, and records
 * downstream product-webhook failures in the DLQ.
 *
 * =============================================================================
 */

import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { ConektaService } from './services/conekta.service';

@ApiTags('Billing — Conekta (Wave A)')
@Controller('billing')
export class ConektaController {
  private readonly logger = new Logger(ConektaController.name);

  constructor(private readonly conekta: ConektaService) {}

  /**
   * Conekta webhook receiver.
   *
   * Conekta sends signatures in the `digest` header (preferred,
   * `sha256=<hex>`) or `conekta-signature` (legacy `t=...,v1=<hex>`).
   * We accept both via `ConektaService.verifyWebhookSignature`.
   *
   * Failure modes:
   * - Conekta not configured → 400 (operator hasn't run the runbook yet)
   * - Missing/empty signature → 400
   * - Signature mismatch → 400
   * - Body parse failure → 400
   * - Handler crash → log + 200 ACK (don't trigger Conekta retry storms
   *   for downstream transient errors; our own Sentry surfaces the failure)
   */
  @Post('webhooks/conekta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Conekta webhook receiver (charge.paid, charge.declined, charge.refunded, order.expired). Signature-verified, idempotent.',
  })
  @ApiOkResponse({
    description: 'Webhook accepted (ACK is independent of handler outcome).',
  })
  @ApiBadRequestResponse({
    description: 'Invalid Conekta signature, missing config, or malformed body.',
  })
  async handleConektaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('digest') digestHeader: string | undefined,
    @Headers('conekta-signature') legacySignatureHeader: string | undefined
  ): Promise<{
    received: true;
    handled: boolean;
    classification: string;
    eventType?: string;
    eventId?: string;
  }> {
    if (!this.conekta.isConfigured()) {
      this.logger.error('Conekta webhook rejected: gateway not configured');
      throw new BadRequestException('Conekta gateway not configured');
    }

    const signatureHeader = digestHeader ?? legacySignatureHeader ?? '';
    if (!signatureHeader) {
      this.logger.warn('Conekta webhook rejected: missing digest/conekta-signature header');
      throw new BadRequestException('Missing Conekta signature header');
    }

    const rawBuffer = (req.rawBody ?? (req as unknown as { body?: Buffer }).body) as
      | Buffer
      | string
      | undefined;
    const rawBody =
      typeof rawBuffer === 'string'
        ? rawBuffer
        : Buffer.isBuffer(rawBuffer)
          ? rawBuffer.toString('utf8')
          : '';

    let event;
    try {
      event = this.conekta.verifyWebhookSignature(rawBody, signatureHeader);
    } catch (err) {
      this.logger.warn(`Conekta webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid Conekta signature');
    }

    this.logger.log(
      `Conekta webhook received: type=${event.type} id=${event.id} livemode=${event.livemode}`
    );

    try {
      const result = await this.conekta.handleWebhookEvent(event);
      return {
        received: true,
        handled: result.handled,
        classification: result.classification,
        eventType: event.type,
        eventId: event.id,
      };
    } catch (err) {
      // Don't 500 back to Conekta — that triggers exponential retry that
      // can amplify into a thundering herd. Log + ACK 200; downstream
      // dead-letter / Sentry surfaces the failure.
      this.logger.error(`Conekta handler failure for event ${event.id}: ${(err as Error).message}`);
      return {
        received: true,
        handled: false,
        classification: 'error',
        eventType: event.type,
        eventId: event.id,
      };
    }
  }
}
