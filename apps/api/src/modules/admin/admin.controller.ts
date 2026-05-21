import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '@core/types/authenticated-request';

import { AdminOpsService } from './admin-ops.service';
import { AdminService } from './admin.service';
import {
  UserSearchDto,
  UserDetailsDto,
  SystemStatsDto,
  AuditLogSearchDto,
  AdminPosCheckoutDto,
  OnboardingFunnelDto,
  FeatureFlagDto,
  UpdateFeatureFlagDto,
  PaginatedResponseDto,
  CacheFlushDto,
  ClearQueueDto,
  SpaceSearchDto,
  UserActionDto,
} from './dto';
import { AdminGuard } from './guards/admin.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
@ApiForbiddenResponse({ description: 'User lacks admin privileges' })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminOpsService: AdminOpsService
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Search and list users with pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Users retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async searchUsers(@Query() dto: UserSearchDto): Promise<PaginatedResponseDto<any>> {
    return this.adminService.searchUsers(dto);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Get detailed user information (read-only)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User details retrieved successfully',
    type: UserDetailsDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async getUserDetails(
    @Param('userId') userId: string,
    @Request() req: AuthenticatedRequest
  ): Promise<UserDetailsDto> {
    return this.adminService.getUserDetails(userId, req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system-wide statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'System stats retrieved successfully',
    type: SystemStatsDto,
  })
  async getSystemStats(): Promise<SystemStatsDto> {
    return this.adminService.getSystemStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Search and view audit logs' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async searchAuditLogs(@Query() dto: AuditLogSearchDto): Promise<PaginatedResponseDto<any>> {
    return this.adminService.searchAuditLogs(dto);
  }

  @Get('analytics/onboarding-funnel')
  @ApiOperation({ summary: 'Get onboarding funnel analytics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Onboarding analytics retrieved successfully',
    type: OnboardingFunnelDto,
  })
  async getOnboardingFunnel(): Promise<OnboardingFunnelDto> {
    return this.adminService.getOnboardingFunnel();
  }

  @Get('feature-flags')
  @ApiOperation({ summary: 'List all feature flags' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flags retrieved successfully',
    type: [FeatureFlagDto],
  })
  async getFeatureFlags(): Promise<FeatureFlagDto[]> {
    return this.adminService.getFeatureFlags();
  }

  @Get('feature-flags/:key')
  @ApiOperation({ summary: 'Get a specific feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flag retrieved successfully',
    type: FeatureFlagDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feature flag not found' })
  async getFeatureFlag(@Param('key') key: string): Promise<FeatureFlagDto> {
    const flag = await this.adminService.getFeatureFlag(key);
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    return flag;
  }

  @Post('feature-flags/:key')
  @ApiOperation({ summary: 'Update a feature flag' })
  @ApiParam({ name: 'key', description: 'Feature flag key' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Feature flag updated successfully',
    type: FeatureFlagDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Feature flag not found' })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @Request() req: AuthenticatedRequest
  ): Promise<FeatureFlagDto> {
    return this.adminService.updateFeatureFlag(key, dto, req.user.id);
  }

  // ──────────────────────────────────────────────
  // Phase 5 endpoints
  // ──────────────────────────────────────────────

  @Get('health')
  @ApiOperation({ summary: 'System health check (DB, Redis, queues, providers)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Health status retrieved' })
  async getSystemHealth(@Request() req: AuthenticatedRequest) {
    return this.adminOpsService.getSystemHealth(req.user.id);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'DAU/WAU/MAU, queue stats, resource usage' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Metrics retrieved' })
  async getMetrics(@Request() req: AuthenticatedRequest) {
    return this.adminOpsService.getMetrics(req.user.id);
  }

  @Post('cache/flush')
  @ApiOperation({ summary: 'Flush Redis cache by pattern' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cache flushed' })
  @ApiBadRequestResponse({ description: 'Invalid pattern or not confirmed' })
  async flushCache(@Body() dto: CacheFlushDto, @Request() req: AuthenticatedRequest) {
    return this.adminOpsService.flushCache(dto, req.user.id);
  }

  @Get('queues')
  @ApiOperation({ summary: 'BullMQ queue stats' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Queue stats retrieved' })
  async getQueueStats(@Request() req: AuthenticatedRequest) {
    return this.adminOpsService.getQueueStats(req.user.id);
  }

  @Post('queues/:name/retry-failed')
  @ApiOperation({ summary: 'Retry failed jobs in a queue' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Retry initiated' })
  async retryFailedJobs(@Param('name') name: string, @Request() req: AuthenticatedRequest) {
    return this.adminOpsService.retryFailedJobs(name, req.user.id);
  }

  @Get('queues/:name/failed')
  @ApiOperation({ summary: 'List failed jobs in a queue with redacted payloads' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum jobs to return, 1-100' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Failed jobs retrieved' })
  async getFailedJobs(
    @Param('name') name: string,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthenticatedRequest
  ) {
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    return this.adminOpsService.getFailedJobs(name, parsedLimit, req.user.id);
  }

  @Post('queues/:name/clear-failed')
  @ApiOperation({ summary: 'Clear only failed jobs in a queue' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Failed jobs cleared' })
  async clearFailedJobs(
    @Param('name') name: string,
    @Body() dto: ClearQueueDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminOpsService.clearFailedJobs(name, dto.confirm, req.user.id);
  }

  @Post('queues/:name/clear')
  @ApiOperation({ summary: 'Clear a queue' })
  @ApiParam({ name: 'name', description: 'Queue name' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Queue cleared' })
  async clearQueue(
    @Param('name') name: string,
    @Body() dto: ClearQueueDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminOpsService.clearQueue(name, dto.confirm, req.user.id);
  }

  @Get('spaces')
  @ApiOperation({ summary: 'Search and list spaces' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Spaces retrieved' })
  async searchSpaces(@Query() dto: SpaceSearchDto) {
    return this.adminOpsService.searchSpaces(dto);
  }

  @Patch('users/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate user and invalidate sessions' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User deactivated' })
  async deactivateUser(
    @Param('id') id: string,
    @Body() dto: UserActionDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminOpsService.deactivateUser(id, dto, req.user.id);
  }

  @Patch('users/:id/reset-2fa')
  @ApiOperation({ summary: 'Reset TOTP 2FA for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '2FA reset' })
  async resetUserTotp(
    @Param('id') id: string,
    @Body() dto: UserActionDto,
    @Request() req: AuthenticatedRequest
  ) {
    return this.adminOpsService.resetUserTotp(id, dto, req.user.id);
  }

  @Post('users/:id/force-logout')
  @ApiOperation({ summary: 'Invalidate all sessions for a user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sessions invalidated' })
  async forceLogout(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.adminOpsService.forceLogout(id, req.user.id);
  }

  @Get('billing/events')
  @ApiOperation({ summary: 'Billing event log' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: HttpStatus.OK, description: 'Billing events retrieved' })
  async getBillingEvents(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminOpsService.getBillingEvents(page || 1, limit || 20);
  }

  @Post('billing/pos/checkout')
  @ApiOperation({ summary: 'Create an internal MADFAM POS checkout link' })
  @ApiResponse({ status: HttpStatus.OK, description: 'POS checkout link created' })
  @ApiBadRequestResponse({ description: 'Invalid checkout request' })
  async createPosCheckout(@Body() dto: AdminPosCheckoutDto, @Request() req: AuthenticatedRequest) {
    return this.adminOpsService.createPosCheckout(dto, req.user.id);
  }

  @Get('gdpr/export/:userId')
  @ApiOperation({ summary: 'GDPR data export for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Data exported' })
  async gdprExport(@Param('userId') userId: string, @Request() req: AuthenticatedRequest) {
    return this.adminOpsService.gdprExport(userId, req.user.id);
  }

  @Post('gdpr/delete/:userId')
  @ApiOperation({ summary: 'GDPR deletion (queued)' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Deletion queued' })
  async gdprDelete(@Param('userId') userId: string, @Request() req: AuthenticatedRequest) {
    return this.adminOpsService.gdprDelete(userId, req.user.id);
  }

  @Post('retention/execute')
  @ApiOperation({ summary: 'Execute retention policies' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Retention execution initiated' })
  async executeRetention(@Request() req: AuthenticatedRequest) {
    return this.adminOpsService.executeRetention(req.user.id);
  }

  @Get('deployment/status')
  @ApiOperation({ summary: 'Deployment monitor data' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Deployment status retrieved' })
  async getDeploymentStatus() {
    return this.adminOpsService.getDeploymentStatus();
  }

  @Get('providers/health')
  @ApiOperation({ summary: 'Provider health and rate limits' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Provider health retrieved' })
  async getProviderHealth(@Request() req: AuthenticatedRequest) {
    return this.adminOpsService.getProviderHealth(req.user.id);
  }
}
