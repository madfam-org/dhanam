import { randomUUID } from 'crypto';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RedisService } from '../../core/redis/redis.service';

/**
 * Cross-service event publisher using Redis Streams.
 *
 * Publishes billing lifecycle events to `madfam:billing-events` stream
 * for consumption by PhyndCRM, AutoSwarm, and Tezca.
 *
 * Fire-and-forget — publishing failures are logged but never thrown,
 * so they cannot block the billing flow.
 *
 * Stream is capped at ~10000 entries via MAXLEN to prevent unbounded growth.
 */

// Stream constants from @madfam/types — keep in sync with event-schemas.yaml
const STREAM_KEY = 'madfam:billing-events';
const MAX_STREAM_LEN = 10000;

// Re-export for backward compat; canonical definition lives in @madfam/types
export interface EventEnvelope {
  event_type: string;
  source: string;
  correlation_id: string;
  timestamp: string;
  payload: string; // JSON-stringified
}
// TODO(P4-4): Replace with `import { ServiceEventEnvelope, STREAMS } from '@madfam/types'`
// once the package is published to npm.madfam.io and added to dhanam's deps.

@Injectable()
export class EventPublisherService implements OnModuleInit {
  private readonly logger = new Logger(EventPublisherService.name);
  private enabled = false;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    try {
      const ok = await this.redis.ping();
      this.enabled = ok;
      if (ok) {
        this.logger.log(`Event publisher ready (stream: ${STREAM_KEY})`);
      }
    } catch {
      this.logger.warn('Redis not available — event publishing disabled');
    }
  }

  /**
   * Publish an event to the billing stream. Fire-and-forget.
   */
  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.enabled) return;

    try {
      const client = this.redis.getClient();
      const envelope: EventEnvelope = {
        event_type: eventType,
        source: 'dhanam',
        correlation_id: randomUUID(),
        timestamp: new Date().toISOString(),
        payload: JSON.stringify(payload),
      };

      // XADD with approximate maxlen trimming
      await client.xadd(
        STREAM_KEY,
        'MAXLEN',
        '~',
        String(MAX_STREAM_LEN),
        '*', // auto-generate ID
        'event_type',
        envelope.event_type,
        'source',
        envelope.source,
        'correlation_id',
        envelope.correlation_id,
        'timestamp',
        envelope.timestamp,
        'payload',
        envelope.payload
      );

      this.logger.debug(`Published ${eventType} to ${STREAM_KEY}`);
    } catch (error) {
      this.logger.warn(`Failed to publish ${eventType}: ${error.message}`);
    }
  }

  // --- Convenience methods for billing events ---

  async subscriptionCreated(data: {
    userId: string;
    email: string;
    plan: string;
    status: string;
    provider: string;
    currency: string;
    amount: number;
  }) {
    return this.publish('billing.subscription.created', {
      user_id: data.userId,
      email: data.email,
      plan: data.plan,
      status: data.status,
      provider: data.provider,
      currency: data.currency,
      amount: data.amount,
    });
  }

  async subscriptionCancelled(data: {
    userId: string;
    plan: string;
    reason?: string;
    effectiveAt: string;
  }) {
    return this.publish('billing.subscription.cancelled', {
      user_id: data.userId,
      plan: data.plan,
      reason: data.reason,
      effective_at: data.effectiveAt,
    });
  }

  async paymentSucceeded(data: {
    userId: string;
    amount: number;
    currency: string;
    provider: string;
    invoiceId?: string;
  }) {
    return this.publish('billing.payment.succeeded', {
      user_id: data.userId,
      amount: data.amount,
      currency: data.currency,
      provider: data.provider,
      invoice_id: data.invoiceId,
    });
  }

  async paymentFailed(data: {
    userId: string;
    amount: number;
    currency: string;
    errorMessage?: string;
  }) {
    return this.publish('billing.payment.failed', {
      user_id: data.userId,
      amount: data.amount,
      currency: data.currency,
      error_message: data.errorMessage,
    });
  }

  async kycVerified(data: { userId: string; email: string; verificationId: string }) {
    return this.publish('kyc.verified', {
      user_id: data.userId,
      email: data.email,
      verification_id: data.verificationId,
    });
  }
}
