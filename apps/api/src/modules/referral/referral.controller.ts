import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiHeader,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../core/types/authenticated-request';

import { AmbassadorService } from './ambassador.service';
import { ReferralConversionWebhookDto } from './dto/referral-event.dto';
import { ReferralHmacGuard } from './guards/referral-hmac.guard';
import { ReferralService } from './referral.service';

/**
 * =============================================================================
 * Referral Controller (Rewards-Only)
 * =============================================================================
 * Endpoints for referral reward management and ambassador tiers.
 *
 * Funnel tracking (codes, lifecycle) has moved to PhyndCRM.
 * Dhanam retains only reward application and ambassador tier management.
 *
 * ## Authentication Modes
 * - **HMAC**: Receive `referral.converted` webhook from PhyndCRM
 * - **JWT**: User-facing queries (reward history, ambassador profile)
 *
 * All paths are prefixed with `/v1/referral` by the global route prefix.
 * =============================================================================
 */
@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  private readonly logger = new Logger(ReferralController.name);

  constructor(
    private readonly referralService: ReferralService,
    private readonly ambassadorService: AmbassadorService
  ) {}

  // ─── HMAC-Protected Endpoint (Service-to-Service) ────────────────────

  /**
   * Receive a referral conversion webhook from PhyndCRM.
   * Authenticated via HMAC-SHA256 signature in X-PhyndCRM-Signature
   * or X-Referral-Signature header.
   *
   * Creates reward rows (1 month extension for referrer + 50 credits each)
   * and recalculates the referrer's ambassador tier.
   */
  @Post('reward')
  @UseGuards(ReferralHmacGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive referral conversion webhook from PhyndCRM (HMAC-signed)',
    description:
      'Processes a referral.converted event from PhyndCRM. ' +
      'Creates rewards and recalculates ambassador tier. ' +
      'Authenticated via HMAC-SHA256 signature in X-PhyndCRM-Signature or X-Referral-Signature header.',
  })
  @ApiHeader({
    name: 'X-PhyndCRM-Signature',
    description: 'HMAC-SHA256 hex signature of request body',
  })
  @ApiCreatedResponse({ description: 'Rewards created and tier recalculated' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing HMAC signature' })
  async handleConversionWebhook(@Body() dto: ReferralConversionWebhookDto) {
    return this.referralService.handleConversionWebhook(dto.data);
  }

  // ─── JWT-Protected Endpoints ─────────────────────────────────────────

  /**
   * Get reward history for the authenticated user.
   */
  @Get('rewards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reward history' })
  @ApiOkResponse({ description: 'Reward history returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getRewards(@Req() req: AuthenticatedRequest) {
    return this.referralService.getRewards(req.user.id);
  }

  /**
   * Get ambassador profile and tier information.
   */
  @Get('ambassador')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ambassador profile and tier' })
  @ApiOkResponse({ description: 'Ambassador profile returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getAmbassadorProfile(@Req() req: AuthenticatedRequest) {
    return this.ambassadorService.getProfile(req.user.id);
  }
}
