import * as crypto from 'crypto';

import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ComplianceBridgeDirection,
  ComplianceBridgeResolution,
  OwnerCapitalJournalStatus,
  Prisma,
} from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';

import { ComplianceBridgeEventService } from './compliance-bridge-event.service';
import { CapitalFlowResolvedDto, KarafielManualActionDto } from './dto/capital-stack.dto';

@ApiTags('internal-compliance')
@Controller('internal/compliance')
export class InternalComplianceController {
  private readonly logger = new Logger(InternalComplianceController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly bridgeEvents: ComplianceBridgeEventService
  ) {}

  @Post('capital-flow-resolved')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Karafiel callback after capital-flow seal / CFDI / rejection' })
  @ApiHeader({ name: 'X-Dhanam-Signature', description: 'HMAC-SHA256 of raw body' })
  async capitalFlowResolved(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-dhanam-signature') signature: string,
    @Body() dto: CapitalFlowResolvedDto
  ) {
    this.verifySignature(req, signature, dto);

    const status = this.mapResolutionToStatus(dto.resolution);

    await this.prisma.ownerCapitalJournal.updateMany({
      where: { id: dto.correlation_id },
      data: {
        status,
        karafielCaseId: dto.karafiel_case_id,
        metadata: {
          cfdiUuid: dto.cfdi_uuid,
          sealedAt: dto.sealed_at,
          operatorNotes: dto.operator_notes,
        },
      },
    });

    await this.bridgeEvents.record({
      journalId: dto.correlation_id,
      direction: ComplianceBridgeDirection.karafiel_to_dhanam,
      eventType: 'capital_flow_resolved',
      correlationId: dto.correlation_id,
      resolution: ComplianceBridgeResolution.auto,
      payload: dto as unknown as Prisma.InputJsonValue,
    });

    this.logger.log(`Capital flow resolved correlation=${dto.correlation_id} status=${status}`);
    return { status: 'ok', correlation_id: dto.correlation_id };
  }

  @Post('manual-action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Karafiel operator manual action sync' })
  @ApiHeader({ name: 'X-Dhanam-Signature', description: 'HMAC-SHA256 of raw body' })
  async manualAction(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-dhanam-signature') signature: string,
    @Body() dto: KarafielManualActionDto
  ) {
    this.verifySignature(req, signature, dto);

    const journal = await this.prisma.ownerCapitalJournal.findUnique({
      where: { id: dto.correlation_id },
    });

    if (journal) {
      const newFlowType =
        typeof dto.payload?.new_flow_type === 'string'
          ? (dto.payload.new_flow_type as typeof journal.flowType)
          : journal.flowType;

      await this.prisma.ownerCapitalJournal.update({
        where: { id: dto.correlation_id },
        data: {
          flowType: newFlowType,
          status: OwnerCapitalJournalStatus.manual_review,
          metadata: {
            ...(typeof journal.metadata === 'object' && journal.metadata !== null
              ? journal.metadata
              : {}),
            karafielManualAction: dto as unknown as Prisma.InputJsonValue,
          },
        },
      });
    }

    await this.bridgeEvents.record({
      journalId: dto.correlation_id,
      direction: ComplianceBridgeDirection.karafiel_to_dhanam,
      eventType: 'manual_action',
      correlationId: dto.correlation_id,
      resolution: ComplianceBridgeResolution.manual,
      payload: dto as unknown as Prisma.InputJsonValue,
      resolvedBy: dto.actor_email,
    });

    return { status: 'ok', correlation_id: dto.correlation_id };
  }

  private mapResolutionToStatus(resolution: string): OwnerCapitalJournalStatus {
    switch (resolution) {
      case 'sealed':
      case 'cfdi_issued':
        return OwnerCapitalJournalStatus.compliance_sealed;
      case 'rejected':
        return OwnerCapitalJournalStatus.void;
      case 'manual_closed':
        return OwnerCapitalJournalStatus.manual_review;
      default:
        return OwnerCapitalJournalStatus.compliance_pending;
    }
  }

  private verifySignature(
    req: RawBodyRequest<Request>,
    signature: string,
    dto: CapitalFlowResolvedDto | KarafielManualActionDto
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing X-Dhanam-Signature header');
    }

    const secret = this.config.get<string>('DHANAM_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Signature verification not configured');
    }

    const rawBody =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : req.rawBody
          ? req.rawBody.toString('utf8')
          : JSON.stringify(dto);

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signature.trim(), 'utf8');

    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
