import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../core/types/authenticated-request';

import {
  CreateDestinationChargeDto,
  CreateMerchantDto,
  CreatePayoutDto,
  CreateTransferDto,
  OnboardingLinkDto,
  SubmitDisputeEvidenceDto,
} from './dto/marketplace.dto';
import { ChargeService } from './services/charge.service';
import { DisputeService } from './services/dispute.service';
import { MerchantService } from './services/merchant.service';
import { PayoutService } from './services/payout.service';
import { TransferService } from './services/transfer.service';

/**
 * Marketplace HTTP surface. All endpoints sit under /billing/* (same as
 * the B2C subscription controller) to give consumers a single billing
 * namespace. Authentication: JWT issued by Janua.
 *
 * See docs/rfcs/connect-marketplace.md for the contract.
 */
@ApiTags('Marketplace')
@ApiBearerAuth()
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class MarketplaceController {
  private readonly logger = new Logger(MarketplaceController.name);

  constructor(
    private readonly merchants: MerchantService,
    private readonly charges: ChargeService,
    private readonly transfers: TransferService,
    private readonly payouts: PayoutService,
    private readonly disputes: DisputeService
  ) {}

  // ---------------------------------------------------------------------------
  // Merchants
  // ---------------------------------------------------------------------------

  @Post('merchants')
  @ApiOperation({ summary: 'Create a Connect merchant account for the current user' })
  @ApiCreatedResponse()
  async createMerchant(@Req() req: AuthenticatedRequest, @Body() dto: CreateMerchantDto) {
    if (!req.user.email) {
      throw new BadRequestException('Authenticated user has no email on profile');
    }
    return this.merchants.createForUser(req.user.id, req.user.email, {
      country: dto.country,
      defaultCurrency: dto.defaultCurrency,
      businessType: dto.businessType,
      metadata: dto.metadata,
    });
  }

  @Get('merchants')
  @ApiOperation({ summary: 'List merchant accounts owned by the current user' })
  @ApiOkResponse()
  async listMerchants(@Req() req: AuthenticatedRequest) {
    return this.merchants.listForUser(req.user.id);
  }

  @Get('merchants/:id')
  @ApiOperation({ summary: 'Get a merchant account by id' })
  @ApiNotFoundResponse()
  async getMerchant(@Param('id') id: string) {
    return this.merchants.getById(id);
  }

  @Post('merchants/:id/onboarding-link')
  @ApiOperation({ summary: 'Generate / refresh a Connect onboarding link' })
  async onboardingLink(@Param('id') id: string, @Body() dto: OnboardingLinkDto) {
    return this.merchants.getOnboardingLink(id, dto.returnUrl, dto.refreshUrl);
  }

  @Get('merchants/:id/balance')
  @ApiOperation({ summary: 'Retrieve available + pending balance for a merchant' })
  async balance(@Param('id') id: string) {
    return this.merchants.getBalance(id);
  }

  // ---------------------------------------------------------------------------
  // Charges (destination charges)
  // ---------------------------------------------------------------------------

  @Post('charges')
  @ApiOperation({
    summary: 'Create a destination charge — customer pays, merchant receives less the platform fee',
  })
  async createCharge(@Body() dto: CreateDestinationChargeDto) {
    return this.charges.createDestination(dto);
  }

  // ---------------------------------------------------------------------------
  // Transfers
  // ---------------------------------------------------------------------------

  @Post('transfers')
  @ApiOperation({ summary: 'Move funds from the platform to a merchant' })
  async createTransfer(@Body() dto: CreateTransferDto) {
    return this.transfers.create(dto);
  }

  @Get('merchants/:id/transfers')
  @ApiOperation({ summary: 'List transfers to a merchant' })
  async listTransfers(@Param('id') merchantId: string) {
    return this.transfers.listForMerchant(merchantId);
  }

  // ---------------------------------------------------------------------------
  // Payouts
  // ---------------------------------------------------------------------------

  @Post('payouts')
  @ApiOperation({ summary: 'Trigger a payout from a merchant balance to its bank' })
  async createPayout(@Body() dto: CreatePayoutDto) {
    return this.payouts.create(dto);
  }

  @Get('merchants/:id/payouts')
  @ApiOperation({ summary: 'List payouts for a merchant' })
  async listPayouts(@Param('id') merchantId: string) {
    return this.payouts.listForMerchant(merchantId);
  }

  // ---------------------------------------------------------------------------
  // Disputes
  // ---------------------------------------------------------------------------

  @Get('disputes/:id')
  @ApiOperation({ summary: 'Get a dispute by id' })
  async getDispute(@Param('id') id: string) {
    return this.disputes.get(id);
  }

  @Post('disputes/:id/evidence')
  @ApiOperation({ summary: 'Submit evidence for a dispute' })
  async submitEvidence(@Param('id') id: string, @Body() dto: SubmitDisputeEvidenceDto) {
    return this.disputes.submitEvidence(id, dto);
  }
}
