import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PrismaService } from '../../core/prisma/prisma.service';

import { RegisterEndpointDto, UpdateEndpointDto } from './dto/webhook-endpoint.dto';
import { SvixClient } from './services/svix.client';

/**
 * Webhook endpoint management. Consumer apps (forj, karafiel, ...)
 * register a URL here and receive a signing secret in the response
 * exactly once — they must persist it. Rotations go through
 * POST /:id/rotate-secret and return a fresh secret.
 *
 * URL validation: the hostname must be on WEBHOOK_ENDPOINT_HOST_ALLOWLIST
 * (comma-separated, env). This mirrors the existing PUBLIC_CHECKOUT_ALLOWED_HOSTS
 * pattern from billing and prevents SSRF / callback abuse.
 */
@ApiTags('Webhook Endpoints')
@ApiBearerAuth()
@Controller('billing/webhook-endpoints')
@UseGuards(JwtAuthGuard)
export class WebhookEndpointsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly svix: SvixClient,
    private readonly config: ConfigService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a webhook endpoint. Returns the signing secret ONCE.' })
  async register(@Body() dto: RegisterEndpointDto) {
    this.validateUrl(dto.url);
    const { id: svixEndpointId, secret } = await this.svix.createEndpoint(dto.consumerAppId, {
      url: dto.url,
      description: dto.description,
      filterTypes: dto.subscribedEvents.length ? dto.subscribedEvents : undefined,
    });
    const row = await this.prisma.webhookEndpoint.create({
      data: {
        consumerAppId: dto.consumerAppId,
        url: dto.url,
        svixEndpointId,
        subscribedEvents: dto.subscribedEvents,
        description: dto.description,
      },
    });
    return {
      id: row.id,
      consumerAppId: row.consumerAppId,
      url: row.url,
      subscribedEvents: row.subscribedEvents,
      signingSecret: secret,
      warning:
        'Store signingSecret now — it will not be shown again. Use POST /:id/rotate-secret to get a fresh one.',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  async list() {
    return this.prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEndpointDto) {
    return this.prisma.webhookEndpoint.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.svixEndpointId) {
      await this.svix.deleteEndpoint(row.consumerAppId, row.svixEndpointId);
    }
    await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { active: false, disabledAt: new Date() },
    });
    return { id, active: false };
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rotate the signing secret. Old secret is invalidated immediately.' })
  async rotate(@Param('id') id: string) {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (!row.svixEndpointId) {
      throw new BadRequestException('Endpoint has no Svix id; re-register required');
    }
    const { secret } = await this.svix.rotateEndpointSecret(row.consumerAppId, row.svixEndpointId);
    return {
      id,
      signingSecret: secret,
      warning: 'Previous secret is invalidated. Deploy the new one to all consumers immediately.',
    };
  }

  @Post(':id/replay-failed')
  @ApiOperation({ summary: 'Replay failed deliveries in the last N seconds (default 3600)' })
  async replay(@Param('id') id: string, @Body() body: { sinceSeconds?: number }) {
    const row = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (!row.svixEndpointId) {
      throw new BadRequestException('Endpoint has no Svix id');
    }
    await this.svix.replayFailedMessages(
      row.consumerAppId,
      row.svixEndpointId,
      body.sinceSeconds ?? 3600
    );
    return { id, replayed: true };
  }

  private validateUrl(url: string) {
    const allowlistCsv = this.config.get<string>('WEBHOOK_ENDPOINT_HOST_ALLOWLIST', '');
    const allowed = allowlistCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowed.length === 0) {
      // Fail closed if no allowlist is configured — safer default.
      throw new BadRequestException(
        'WEBHOOK_ENDPOINT_HOST_ALLOWLIST not configured; refusing to register any endpoint'
      );
    }
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (!allowed.some((entry) => host === entry || host.endsWith(`.${entry}`))) {
      throw new BadRequestException(`Host ${host} is not on WEBHOOK_ENDPOINT_HOST_ALLOWLIST`);
    }
  }
}
