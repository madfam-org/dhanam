import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthenticatedUser } from '@core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { OwnerCapitalFlowType, OwnerCapitalJournalStatus } from '@db';

import { CapitalStackAccountsService } from './capital-stack-accounts.service';
import {
  CreateJournalDto,
  MatchJournalDto,
  BulkCapitalPurposeDto,
  UpdateCapitalPurposeDto,
} from './dto/capital-stack.dto';
import { EntityGroupService } from './entity-group.service';
import { KarafielCapitalBridgeService } from './karafiel-capital-bridge.service';
import { OwnerCapitalJournalService } from './owner-capital-journal.service';

@ApiTags('Capital Stack')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('capital-stack')
export class CapitalStackController {
  constructor(
    private readonly config: ConfigService,
    private readonly entityGroups: EntityGroupService,
    private readonly journals: OwnerCapitalJournalService,
    private readonly karafielBridge: KarafielCapitalBridgeService,
    private readonly accounts: CapitalStackAccountsService
  ) {}

  private assertEnabled() {
    if (this.config.get<string>('FEATURE_CAPITAL_STACK_ENABLED') !== 'true') {
      throw new ForbiddenException('Capital stack feature is not enabled');
    }
  }

  @Get('groups')
  @ApiOperation({ summary: 'List owner-operator entity groups for current user' })
  async listGroups(@CurrentUser() user: AuthenticatedUser) {
    this.assertEnabled();
    return this.entityGroups.listForUser(user.id);
  }

  @Get('groups/:id/dashboard')
  @ApiOperation({ summary: 'Owner cockpit metrics for an entity group' })
  async dashboard(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertEnabled();
    return this.entityGroups.getDashboard(id, user.id);
  }

  @Get('journal')
  @ApiOperation({ summary: 'List owner capital journal entries' })
  async listJournal(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityGroupId') entityGroupId?: string,
    @Query('status') status?: OwnerCapitalJournalStatus,
    @Query('flowType') flowType?: OwnerCapitalFlowType
  ) {
    this.assertEnabled();
    return this.journals.list(user.id, { entityGroupId, status, flowType });
  }

  @Post('journal')
  @ApiOperation({ summary: 'Create owner capital journal entry' })
  async createJournal(@Body() dto: CreateJournalDto, @CurrentUser() user: AuthenticatedUser) {
    this.assertEnabled();
    return this.journals.create(dto, user.id, user.isAdmin);
  }

  @Post('journal/:id/match')
  @ApiOperation({ summary: 'Match journal entry to business-side transaction' })
  async matchJournal(
    @Param('id') id: string,
    @Body() dto: MatchJournalDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.assertEnabled();
    return this.journals.match(id, dto, user.id, user.isAdmin);
  }

  @Post('journal/:id/send-to-karafiel')
  @ApiOperation({ summary: 'Send journal entry to Karafiel for compliance processing' })
  async sendToKarafiel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertEnabled();
    return this.karafielBridge.sendJournalToKarafiel(id, user.id);
  }

  @Get('groups/:id/accounts')
  @ApiOperation({ summary: 'List accounts in entity group with capital purpose' })
  async listAccounts(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    this.assertEnabled();
    return this.accounts.listForEntityGroup(id, user.id);
  }

  @Post('accounts/bulk-capital-purpose')
  @ApiOperation({ summary: 'Bulk classify accounts by capital purpose' })
  async bulkCapitalPurpose(
    @Body() dto: BulkCapitalPurposeDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.assertEnabled();
    return this.accounts.bulkSetCapitalPurpose(
      dto.entityGroupId,
      dto.updates,
      user.id,
      user.isAdmin
    );
  }

  @Patch('accounts/:accountId/capital-purpose')
  @ApiOperation({ summary: 'Set account capital purpose classification' })
  async updateCapitalPurpose(
    @Param('accountId') accountId: string,
    @Body() dto: UpdateCapitalPurposeDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    this.assertEnabled();
    return this.journals.setAccountCapitalPurpose(accountId, dto.capitalPurpose, user.id);
  }
}
