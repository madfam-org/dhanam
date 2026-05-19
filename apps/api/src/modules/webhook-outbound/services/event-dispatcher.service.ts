import { randomUUID } from 'crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { SvixClient } from './svix.client';

/**
 * EventDispatcherService — the single emission point for all outbound
 * dhanam webhook events. Services call `emit(eventType, payload)` and
 * we take care of:
 *   - fanning out to every registered WebhookEndpoint whose
 *     `subscribedEvents` matches the type (or is empty = all),
 *   - handing the message to Svix for retry + delivery,
 *   - persisting a WebhookDelivery row for local audit / replay.
 *
 * Consumers verify messages using the Svix signing headers
 * (svix-id, svix-timestamp, svix-signature) — @dhanam/billing-sdk
 * exposes a helper that wraps the Svix verifier.
 */
@Injectable()
export class EventDispatcherService {
  private readonly logger = new Logger(EventDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly svix: SvixClient
  ) {}

  async emit(eventType: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.svix.isEnabled()) {
      this.logger.debug(`Svix disabled; dropping event ${eventType}`);
      return;
    }

    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: {
        active: true,
        OR: [{ subscribedEvents: { has: eventType } }, { subscribedEvents: { isEmpty: true } }],
      },
    });

    if (endpoints.length === 0) {
      this.logger.debug(`No subscribers for ${eventType}`);
      return;
    }

    const eventId = `evt_${randomUUID()}`;
    const envelope = {
      id: eventId,
      type: eventType,
      created: Math.floor(Date.now() / 1000),
      livemode: process.env.NODE_ENV === 'production',
      data: payload,
    };

    for (const endpoint of endpoints) {
      try {
        const { svixMessageId } = await this.svix.sendMessage(endpoint.consumerAppId, {
          eventType,
          payload: envelope,
          eventId,
        });
        await this.prisma.webhookDelivery.create({
          data: {
            webhookEndpointId: endpoint.id,
            eventType,
            eventId,
            svixMessageId,
            payload: envelope as unknown as object,
            lastAttemptAt: new Date(),
            attempts: 1,
          },
        });
      } catch (err) {
        this.logger.error(
          `Failed to dispatch ${eventType} to endpoint ${endpoint.id}: ${(err as Error).message}`
        );
        await this.prisma.webhookDelivery.create({
          data: {
            webhookEndpointId: endpoint.id,
            eventType,
            eventId,
            payload: envelope as unknown as object,
            lastAttemptAt: new Date(),
            attempts: 1,
            lastStatus: 0,
          },
        });
        // Continue with other endpoints — one failing subscriber
        // doesn't block the rest.
      }
    }
  }
}
