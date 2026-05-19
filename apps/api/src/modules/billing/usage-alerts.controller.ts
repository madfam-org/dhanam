/**
 * Usage Alerts Controller (P2.2)
 * ==========================================================================
 * Inbound webhook endpoint for Enclii's Waybill budget evaluator.
 *
 * Security model
 * --------------
 * Waybill signs each request using the MADFAM ecosystem envelope format:
 *
 *   X-Madfam-Signature: t=<unix-seconds>,v1=<hex-hmac-sha256>
 *
 * where HMAC is computed over `${t}.${rawBody}` using
 * `WAYBILL_ALERT_SIGNING_KEY`. The verification path uses
 * `verifyMadfamSignature()` — the exact same primitive used by the
 * madfam-events controller — so secret rotation, replay-window policy, and
 * constant-time comparison are all centralized.
 */
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PrismaService } from '../../core/prisma/prisma.service';

import { verifyMadfamSignature } from './madfam-events.sig';
import { UsageAlertsService, WaybillAlertPayload } from './services/usage-alerts.service';

@ApiTags('Usage Alerts (Waybill)')
@Controller('billing/usage-alerts')
export class UsageAlertsController {
  private readonly logger = new Logger(UsageAlertsController.name);

  constructor(
    private readonly service: UsageAlertsService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * List recent alerts for the authenticated user's workspace.
   *
   * P2.2 scope note: the federation wiring that maps Dhanam users to
   * Enclii projects isn't finished yet, so this returns the 100 most-recent
   * rows globally. When federation lands, filter by `projectId IN (user's
   * enclii projects)`. Tracked in the roadmap.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List recent Waybill usage alerts (authenticated)' })
  async list(@Query('limit') limit?: string) {
    const take = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 200);
    const alerts = await this.prisma.usageAlertIngest.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
    // BigInt serialization: coerce to Number before returning. Safe since
    // cents values stay well under 2^53 in any realistic scenario.
    return {
      alerts: alerts.map((a) => ({
        ...a,
        actualCents: Number(a.actualCents),
        budgetCents: Number(a.budgetCents),
      })),
    };
  }

  @Post('ingest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive a budget threshold alert from Waybill',
    description:
      'Signed with HMAC-SHA256 using WAYBILL_ALERT_SIGNING_KEY. Idempotent by (project_id, period_start, threshold_crossed).',
  })
  @ApiHeader({
    name: 'X-Madfam-Signature',
    description: 't=<unix>,v1=<hmac_hex> — HMAC-SHA256 of `${t}.${body}`',
    required: true,
  })
  async ingest(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-madfam-signature') signature: string | undefined,
    @Body() body: WaybillAlertPayload
  ) {
    const secret = this.config.get<string>('WAYBILL_ALERT_SIGNING_KEY');
    if (!secret) {
      this.logger.error('WAYBILL_ALERT_SIGNING_KEY not configured');
      throw new UnauthorizedException('alert signature verification not configured');
    }

    const rawBody = this.extractRawBody(req);
    const verdict = verifyMadfamSignature(rawBody, signature ?? null, secret);
    if (!verdict.ok) {
      this.logger.warn(`signature check failed: ${verdict.reason}`);
      throw new UnauthorizedException(`invalid signature: ${verdict.reason}`);
    }

    try {
      const result = await this.service.ingest(body);
      return result;
    } catch (err) {
      const msg = (err as Error).message ?? 'ingest failed';
      this.logger.warn(`ingest rejected: ${msg}`);
      throw new BadRequestException(msg);
    }
  }

  private extractRawBody(req: RawBodyRequest<Request>): string {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (req.rawBody) return req.rawBody.toString();
    return JSON.stringify(req.body ?? {});
  }
}
