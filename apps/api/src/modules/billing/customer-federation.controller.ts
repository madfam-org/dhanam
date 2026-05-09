import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ThrottleAuthGuard } from '../../core/security/guards/throttle-auth.guard';

import { BillingService } from './billing.service';
import { FederationAuthGuard } from './guards/federation-auth.guard';
import {
  CustomerFederationService,
  FederatedCustomerResponse,
} from './services/customer-federation.service';

/**
 * =============================================================================
 * Customer Federation Controller
 * =============================================================================
 * Provides a read-only federation endpoint for PhyndCRM's DhanamProvider.
 *
 * PhyndCRM federates billing data from Dhanam without duplicating it.
 * This endpoint returns customer subscription status, balance, recent
 * invoices, and payment method references in the DhanamRawCustomer
 * shape defined in @phynd/federation.
 *
 * Authentication: Bearer token (FEDERATION_API_TOKEN shared secret).
 * Rate limit: 60 requests per minute per IP.
 *
 * Route: GET /v1/customers/:externalId
 * =============================================================================
 */
@ApiTags('Federation')
@ApiBearerAuth()
@Controller('customers')
@UseGuards(ThrottleAuthGuard, FederationAuthGuard)
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class CustomerFederationController {
  private readonly logger = new Logger(CustomerFederationController.name);

  constructor(
    private readonly customerFederationService: CustomerFederationService,
    private readonly billingService: BillingService
  ) {}

  /**
   * Fetch customer billing data by external ID.
   *
   * Returns subscription status, account balance, recent invoices,
   * and payment method references for the PhyndCRM federation layer.
   */
  @Get(':externalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get customer billing data for federation (service-to-service)',
    description:
      'Returns customer subscription, balance, invoices, and payment methods ' +
      'in the DhanamRawCustomer format consumed by PhyndCRM federation.',
  })
  @ApiParam({
    name: 'externalId',
    description: 'Dhanam user ID (stored as external reference in PhyndCRM)',
    type: String,
  })
  @ApiOkResponse({
    description: 'Customer billing data retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Customer not found for the given external ID',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing federation Bearer token',
  })
  async getCustomer(@Param('externalId') externalId: string): Promise<FederatedCustomerResponse> {
    this.logger.log(`Federation customer lookup: externalId=${externalId}`);
    return this.customerFederationService.getCustomerByExternalId(externalId);
  }

  /**
   * Create a checkout session for a customer via federation.
   *
   * Returns a checkout URL that PhyndCRM can redirect the customer to.
   */
  @Post(':externalId/checkout')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create checkout session for federation customer',
    description:
      'Creates a Dhanam checkout session and returns the URL. ' +
      'PhyndCRM uses this to trigger subscription upgrades for contacts.',
  })
  @ApiParam({
    name: 'externalId',
    description: 'Dhanam user ID',
    type: String,
  })
  @ApiCreatedResponse({
    description: 'Checkout session created',
  })
  @ApiNotFoundResponse({
    description: 'Customer not found',
  })
  async createCheckout(
    @Param('externalId') externalId: string,
    @Body() body: { planId: string; successUrl?: string; cancelUrl?: string }
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    this.logger.log(`Federation checkout request: externalId=${externalId}, plan=${body.planId}`);
    return this.billingService.createFederatedCheckout(externalId, body.planId, {
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }
}
