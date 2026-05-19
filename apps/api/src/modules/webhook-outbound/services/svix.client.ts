/**
 * =============================================================================
 * SvixClient — thin wrapper around the self-hosted Svix server
 * =============================================================================
 *
 * Svix is deployed inside the MADFAM k3s cluster (see internal-devops for
 * the k8s manifests). This wrapper is the ONLY component in dhanam that
 * is Svix-aware. Swapping for a different webhook backend later is an
 * implementation-detail change behind this class's interface.
 *
 * Configuration (from dhanam-secrets K8s Secret):
 *   - SVIX_API_URL       e.g. http://svix.svix-system.svc.cluster.local:8071
 *   - SVIX_AUTH_TOKEN    token issued by the Svix admin panel
 *
 * Svix concepts:
 *   - Application:  the tenant. We use one Svix application per
 *                   `consumerAppId` (forj, karafiel, ...). Created on
 *                   first endpoint registration for that consumer.
 *   - Endpoint:     the subscribing URL. We store the Svix endpoint id
 *                   in WebhookEndpoint.svixEndpointId.
 *   - Message:      one event emission. Svix handles retry, signing,
 *                   delivery logs, replay.
 * =============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// `svix` is a pure-TS client; install with `pnpm add -F @dhanam/api svix`.
// We require() it lazily so the api container doesn't hard-fail to start
// when Svix is intentionally disabled in a dev environment.

type SvixSDK = any;

import { ErrorCode, InfrastructureException } from '../../../core/exceptions/domain-exceptions';

export interface SvixEndpointCreateInput {
  url: string;
  description?: string;
  filterTypes?: string[];
}

export interface SvixMessageCreateInput {
  eventType: string;
  payload: Record<string, unknown>;
  eventId: string; // idempotency key — dhanam-side event id
}

@Injectable()
export class SvixClient {
  private readonly logger = new Logger(SvixClient.name);
  private svix: SvixSDK | null = null;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('SVIX_AUTH_TOKEN');
    const baseUrl = this.config.get<string>('SVIX_API_URL');
    this.enabled = Boolean(token && baseUrl);

    if (!this.enabled) {
      this.logger.warn(
        'Svix not configured (SVIX_AUTH_TOKEN / SVIX_API_URL missing) — outbound webhooks disabled'
      );
      return;
    }

    // Lazy require — keeps container boot tolerant of missing svix pkg
    // during incremental adoption.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Svix } = require('svix');
      this.svix = new Svix(token, { serverUrl: baseUrl });
      this.logger.log(`Svix client initialized, serverUrl=${baseUrl}`);
    } catch (err) {
      this.logger.error(`Failed to load svix package: ${(err as Error).message}`);
      throw new InfrastructureException(
        ErrorCode.CONFIGURATION_ERROR,
        'Svix package not installed. Run `pnpm add -F @dhanam/api svix`.'
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.svix !== null;
  }

  private ensureEnabled(): SvixSDK {
    if (!this.isEnabled()) {
      throw new InfrastructureException(
        ErrorCode.CONFIGURATION_ERROR,
        'Outbound webhooks are disabled: configure SVIX_API_URL + SVIX_AUTH_TOKEN.'
      );
    }
    return this.svix!;
  }

  /**
   * Create the Svix application for a consumer if it doesn't exist.
   * Svix treats consumerAppId as the unique identifier.
   */
  async ensureApplication(consumerAppId: string, name?: string): Promise<void> {
    const svix = this.ensureEnabled();
    try {
      await svix.application.create(
        { name: name ?? consumerAppId, uid: consumerAppId },
        { idempotencyKey: `app-${consumerAppId}` }
      );
    } catch (err) {
      // Svix returns 409 if already exists. Either way, post-condition
      // (application exists) is satisfied; swallow and continue.
      const msg = (err as Error).message ?? '';
      if (!msg.includes('409') && !msg.toLowerCase().includes('already')) {
        throw err;
      }
    }
  }

  async createEndpoint(
    consumerAppId: string,
    input: SvixEndpointCreateInput
  ): Promise<{ id: string; secret: string }> {
    const svix = this.ensureEnabled();
    await this.ensureApplication(consumerAppId);
    const endpoint = await svix.endpoint.create(consumerAppId, {
      url: input.url,
      description: input.description,
      filterTypes: input.filterTypes,
    });
    const secret = await svix.endpoint.getSecret(consumerAppId, endpoint.id!);
    return { id: endpoint.id!, secret: secret.key };
  }

  async deleteEndpoint(consumerAppId: string, svixEndpointId: string): Promise<void> {
    const svix = this.ensureEnabled();
    await svix.endpoint.delete(consumerAppId, svixEndpointId);
  }

  async rotateEndpointSecret(
    consumerAppId: string,
    svixEndpointId: string
  ): Promise<{ secret: string }> {
    const svix = this.ensureEnabled();
    await svix.endpoint.rotateSecret(consumerAppId, svixEndpointId, {});
    const secret = await svix.endpoint.getSecret(consumerAppId, svixEndpointId);
    return { secret: secret.key };
  }

  async sendMessage(
    consumerAppId: string,
    input: SvixMessageCreateInput
  ): Promise<{ svixMessageId: string }> {
    const svix = this.ensureEnabled();
    await this.ensureApplication(consumerAppId);
    const msg = await svix.message.create(
      consumerAppId,
      {
        eventType: input.eventType,
        payload: input.payload,
        eventId: input.eventId,
      },
      { idempotencyKey: input.eventId }
    );
    return { svixMessageId: msg.id! };
  }

  async replayFailedMessages(
    consumerAppId: string,
    svixEndpointId: string,
    sinceSeconds: number
  ): Promise<void> {
    const svix = this.ensureEnabled();
    const since = new Date(Date.now() - sinceSeconds * 1000);
    await svix.endpoint.recover(consumerAppId, svixEndpointId, { since });
  }
}
