import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { CurrentUser, AuthenticatedUser } from '@core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';

import { LunchMoneyPreflightDto, LunchMoneyStartImportDto } from './dto';
import { PlatformImportService } from './platform-import.service';

@ApiTags('Migration')
@Controller('spaces/:spaceId/migration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MigrationController {
  constructor(private readonly platformImportService: PlatformImportService) {}

  @Get('status')
  @ApiOperation({ summary: 'Migration feature availability for this environment' })
  getStatus() {
    return {
      lunchMoney: this.platformImportService.isLunchMoneyImportEnabled(),
      csv: false,
    };
  }

  @Post('lunchmoney/preflight')
  @ApiOperation({ summary: 'Preview LunchMoney import counts without writing data' })
  @ApiParam({ name: 'spaceId', description: 'Target space ID' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  @ApiForbiddenResponse({ description: 'Feature disabled or insufficient access' })
  @ApiBadRequestResponse({ description: 'Invalid token or LM API error' })
  preflightLunchMoney(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
    @Body() dto: LunchMoneyPreflightDto
  ) {
    return this.platformImportService.preflightLunchMoney(
      user.id,
      spaceId,
      dto.apiToken,
      dto.startDate
    );
  }

  @Post('lunchmoney/start')
  @ApiOperation({ summary: 'Start async LunchMoney → Dhanam import job' })
  @ApiParam({ name: 'spaceId', description: 'Target space ID' })
  startLunchMoneyImport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
    @Body() dto: LunchMoneyStartImportDto
  ) {
    return this.platformImportService.startLunchMoneyImport(
      user.id,
      spaceId,
      dto.apiToken,
      dto.startDate,
      dto.budgetLabel
    );
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List recent import jobs for the space' })
  listJobs(@CurrentUser() user: AuthenticatedUser, @Param('spaceId') spaceId: string) {
    return this.platformImportService.listJobs(user.id, spaceId);
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get import job status and summary' })
  @ApiNotFoundResponse({ description: 'Job not found' })
  getJob(
    @CurrentUser() user: AuthenticatedUser,
    @Param('spaceId') spaceId: string,
    @Param('jobId') jobId: string
  ) {
    return this.platformImportService.getJob(user.id, spaceId, jobId);
  }
}
