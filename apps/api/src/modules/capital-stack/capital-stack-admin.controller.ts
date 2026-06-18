import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { CurrentUser, AuthenticatedUser } from '@core/auth/decorators/current-user.decorator';

import { ComplianceBridgeEventService } from './compliance-bridge-event.service';
import { OwnerCapitalJournalService } from './owner-capital-journal.service';
import { ResolveJournalDto } from './dto/capital-stack.dto';

@ApiTags('Admin Capital Stack')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/capital-stack')
export class CapitalStackAdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly journals: OwnerCapitalJournalService,
    private readonly bridgeEvents: ComplianceBridgeEventService
  ) {}

  private assertEnabled() {
    if (this.config.get<string>('FEATURE_CAPITAL_STACK_ENABLED') !== 'true') {
      throw new ForbiddenException('Capital stack feature is not enabled');
    }
  }

  @Get('review-queue')
  @ApiOperation({ summary: 'Journal entries awaiting operator review' })
  async reviewQueue() {
    this.assertEnabled();
    return this.journals.getReviewQueue();
  }

  @Post('journal/:id/resolve')
  @ApiOperation({ summary: 'Resolve journal manually (out-of-band Karafiel or void)' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveJournalDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.assertEnabled();
    return this.journals.resolveManual(id, user.id, dto);
  }
}

@ApiTags('Admin Compliance Bridge')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/compliance-bridge')
export class ComplianceBridgeAdminController {
  constructor(
    private readonly config: ConfigService,
    private readonly bridgeEvents: ComplianceBridgeEventService
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'Audit trail of Dhanam ↔ Karafiel capital-flow messages' })
  async listEvents(
    @Query('correlationId') correlationId?: string,
    @Query('journalId') journalId?: string
  ) {
    if (this.config.get<string>('FEATURE_CAPITAL_STACK_ENABLED') !== 'true') {
      throw new ForbiddenException('Capital stack feature is not enabled');
    }
    return this.bridgeEvents.list({ correlationId, journalId });
  }
}
