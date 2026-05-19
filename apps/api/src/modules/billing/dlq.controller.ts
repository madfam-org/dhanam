/**
 * Admin-only Dead-Letter Queue controller.
 *
 *   GET  /v1/billing/dlq               — paginated list of unresolved failures
 *   POST /v1/billing/dlq/:id/replay    — re-POST this delivery now (resets attempt)
 *   POST /v1/billing/dlq/:id/resolve   — mark resolved without retry
 *
 * Auth: JWT + `@Roles('ADMIN')` (matches the existing pattern used by
 * `BillingController.getRevenueMetrics()` — RolesGuard treats
 * `user.isAdmin === true` as a global admin pass).
 *
 * Error responses are intentionally generic (`Failure not found` /
 * `Failed to replay delivery`) so an attacker with a leaked admin
 * token cannot enumerate consumer URL structure or downstream errors
 * via 404 / 422 deltas. Detailed error context is logged + sent to
 * Sentry, never returned in HTTP response bodies.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { Roles } from '../../core/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';

import { DlqListQueryDto } from './dto/dlq-list-query.dto';
import { DlqResolveDto } from './dto/dlq-resolve.dto';
import { WebhookDlqService } from './services/webhook-dlq.service';

@ApiTags('Billing — DLQ')
@ApiBearerAuth()
@Controller('billing/dlq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
@ApiForbiddenResponse({ description: 'User lacks admin privileges' })
export class DlqController {
  private readonly logger = new Logger(DlqController.name);

  constructor(private readonly dlq: WebhookDlqService) {}

  @Get()
  @ApiOperation({
    summary: 'List unresolved webhook delivery failures (admin only)',
    description:
      'Paginated. Defaults to unresolved rows newest-first; pass ?includeResolved=true to see history.',
  })
  @ApiOkResponse({ description: 'List returned' })
  async list(@Query() q: DlqListQueryDto) {
    return this.dlq.listFailures({
      consumer: q.consumer,
      since: q.since ? new Date(q.since) : undefined,
      includeResolved: q.includeResolved,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Post(':id/replay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually re-POST a failed delivery (admin only)',
    description:
      'Resets attempt_count and fires immediately. On success, marks the row resolved. On failure, the row is updated with the new error and the next_retry_at is recomputed from a fresh attempt 1.',
  })
  @ApiParam({ name: 'id', description: 'WebhookDeliveryFailure id' })
  @ApiOkResponse({ description: 'Replay attempted; check `ok` field for outcome' })
  async replay(@Param('id') id: string) {
    let result;
    try {
      result = await this.dlq.replayDelivery(id, { force: true });
    } catch (err) {
      // Service throws on not-found; everything else is captured.
      if ((err as Error).message?.includes('not found')) {
        throw new NotFoundException('Failure not found');
      }
      this.logger.error(`Manual replay error for ${id}: ${(err as Error).message}`);
      // Generic message — no leaking consumer URL or downstream payload.
      throw new NotFoundException('Failure not found');
    }
    // Strip server-side error_message from the response so the API
    // doesn't echo arbitrary HTML / cookies / headers from the
    // downstream consumer back to the admin client.
    return {
      id: result.failureId,
      ok: result.ok,
      statusCode: result.statusCode ?? null,
      attemptCount: result.attemptCount,
      nextRetryAt: result.nextRetryAt,
      resolvedAt: result.resolvedAt,
    };
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a failure resolved without retry (admin only)',
    description:
      'Operator handled the delivery out-of-band (e.g., manually issued the CFDI in Karafiel). Captures the optional `reason` in the row for audit.',
  })
  @ApiParam({ name: 'id', description: 'WebhookDeliveryFailure id' })
  @ApiOkResponse({ description: 'Failure marked resolved' })
  async resolve(@Param('id') id: string, @Body() body: DlqResolveDto) {
    try {
      const row = await this.dlq.markResolved(id, { reason: body.reason });
      return {
        id: row.id,
        resolvedAt: row.resolvedAt,
      };
    } catch (_err) {
      // Prisma throws P2025 when the id doesn't exist; map to 404.
      this.logger.warn(`Resolve attempted on missing/invalid DLQ row ${id}`);
      throw new NotFoundException('Failure not found');
    }
  }
}
