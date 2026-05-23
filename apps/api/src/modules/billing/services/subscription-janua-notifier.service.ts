import * as crypto from 'crypto';

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WebhookDlqService } from './webhook-dlq.service';

@Injectable()
export class SubscriptionJanuaNotifierService {
  private readonly logger = new Logger(SubscriptionJanuaNotifierService.name);

  constructor(
    private config: ConfigService,
    @Optional() private dlq?: WebhookDlqService
  ) {}

  async dispatchJanuaRoleUpgrade(januaUserId: string, productId?: string): Promise<void> {
    const januaApiUrl = this.config.get<string>('JANUA_API_URL');
    const januaAdminKey = this.config.get<string>('JANUA_ADMIN_KEY');

    if (!januaApiUrl || !januaAdminKey) {
      this.logger.warn(
        'Cannot dispatch Janua role upgrade: missing JANUA_API_URL or JANUA_ADMIN_KEY'
      );
      return;
    }

    const foundryProductId = this.config.get<string>('STRIPE_FOUNDRY_PRODUCT_ID', 'prod_foundry');
    const productRoleMap: Record<string, string> = {
      [foundryProductId]: 'foundry_tier',
    };

    const role = productId ? productRoleMap[productId] : undefined;
    if (!role) {
      this.logger.log(
        `No Janua role mapping for product ${productId ?? 'unknown'}, skipping dispatch`
      );
      return;
    }

    try {
      const response = await fetch(`${januaApiUrl}/internal/users/${januaUserId}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${januaAdminKey}`,
        },
        body: JSON.stringify({ add_role: role }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Janua role upgrade failed: ${response.status} - ${text}`);
      } else {
        this.logger.log(`Janua role upgraded for user ${januaUserId}: ${role}`);
      }
    } catch (error) {
      this.logger.error(`Janua role upgrade request error: ${(error as Error).message}`);
    }
  }

  async notifyJanuaOfTierChange(orgId: string, customerId: string, planId: string): Promise<void> {
    const januaApiUrl = this.config.get<string>('JANUA_API_URL');
    const dhanamWebhookSecret = this.config.get<string>('DHANAM_WEBHOOK_SECRET');

    if (!januaApiUrl || !dhanamWebhookSecret) {
      this.logger.warn('Cannot notify Janua: missing JANUA_API_URL or DHANAM_WEBHOOK_SECRET');
      return;
    }

    const payload = JSON.stringify({
      type: 'subscription.created',
      data: {
        customer_id: customerId,
        plan_id: planId,
        organization_id: orgId,
      },
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', dhanamWebhookSecret)
      .update(payload)
      .digest('hex');

    try {
      const response = await fetch(`${januaApiUrl}/api/v1/webhooks/dhanam/subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dhanam-Signature': signature,
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Failed to notify Janua of tier change: ${response.status} - ${errorText}`
        );
      } else {
        this.logger.log(`Notified Janua of tier change for org ${orgId} (plan: ${planId})`);
      }
    } catch (error) {
      this.logger.error(`Error notifying Janua of tier change: ${(error as Error).message}`);
    }
  }

  async notifyProductWebhooks(
    orgId: string,
    customerId: string,
    planId: string,
    eventType: string,
    subscriptionId?: string
  ): Promise<void> {
    const urlConfig = this.config.get<string>('PRODUCT_WEBHOOK_URLS');
    const secret = this.config.get<string>('DHANAM_WEBHOOK_SECRET');

    if (!urlConfig || !secret) return;

    const product = planId?.split('_')[0];
    if (!product) return;

    const urlMap: Record<string, string> = {};
    for (const entry of urlConfig.split(',')) {
      const colonIdx = entry.indexOf(':');
      if (colonIdx > 0) {
        const key = entry.slice(0, colonIdx).trim();
        const url = entry.slice(colonIdx + 1).trim();
        urlMap[key] = url;
      }
    }

    const targetUrl = urlMap[product];
    if (!targetUrl) return;

    const envelope = {
      type: eventType,
      id: crypto.randomUUID(),
      data: {
        customer_id: customerId,
        subscription_id: subscriptionId,
        plan_id: planId,
        organization_id: orgId,
        status: eventType.includes('.') ? eventType.split('.')[1] : 'created',
      },
      timestamp: new Date().toISOString(),
    };
    const payload = JSON.stringify(envelope);
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    let statusCode: number | undefined;
    let errorMessage: string | undefined;
    let ok = false;

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dhanam-Signature': signature,
        },
        body: payload,
      });

      statusCode = response.status;
      ok = response.ok;
      if (!ok) {
        try {
          errorMessage = `consumer responded ${response.status}: ${(await response.text()).slice(
            0,
            500
          )}`;
        } catch {
          errorMessage = `consumer responded ${response.status}`;
        }
        this.logger.warn(`Product webhook to ${product} failed: ${response.status}`);
      } else {
        this.logger.log(`Product webhook dispatched to ${product} for ${eventType}`);
      }
    } catch (error) {
      errorMessage = `network/timeout: ${(error as Error).message}`;
      this.logger.error(
        `Product webhook dispatch to ${product} failed: ${(error as Error).message}`
      );
    }

    if (!ok && this.dlq) {
      try {
        await this.dlq.recordFailure({
          eventId: envelope.id,
          consumer: product,
          consumerUrl: targetUrl,
          eventType,
          payload: envelope,
          signatureHeader: signature,
          statusCode,
          errorMessage: errorMessage ?? 'unknown',
        });
      } catch (dlqErr) {
        this.logger.error(
          `Failed to persist DLQ row for ${product} subscription event ${eventType}: ${
            (dlqErr as Error).message
          }`
        );
      }
    }
  }
}
