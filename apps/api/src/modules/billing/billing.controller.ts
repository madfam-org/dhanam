import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  Headers,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';

import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { ThrottleAuthGuard } from '../../core/security/guards/throttle-auth.guard';

import { BillingService } from './billing.service';
import { UpgradeToPremiumDto, CheckoutQueryDto } from './dto';
import { JanuaWebhookPayloadDto, JanuaWebhookEventType } from './dto/janua-webhook.dto';
import { JanuaBillingService } from './janua-billing.service';
import { StripeService } from './stripe.service';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private billingService: BillingService,
    private stripeService: StripeService,
    private januaBillingService: JanuaBillingService,
    private config: ConfigService
  ) {}

  /**
   * Public checkout endpoint for external apps (e.g., Enclii).
   * Validates user_id, plan, and return_url, then redirects to Stripe Checkout.
   * No JWT required — secured by URL allowlist + Stripe session isolation.
   */
  @Get('checkout')
  @UseGuards(ThrottleAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per IP
  @ApiOperation({ summary: 'Redirect to payment checkout (public, no auth)' })
  async publicCheckout(@Query() query: CheckoutQueryDto, @Res() reply: FastifyReply) {
    const allowedHosts = [/\.madfam\.io$/, /\.dhan\.am$/, /\.enclii\.com$/];

    if (process.env.NODE_ENV !== 'production') {
      allowedHosts.push(/^localhost(:\d+)?$/);
    }

    let returnHost: string;
    try {
      returnHost = new URL(query.return_url).hostname;
    } catch {
      throw new BadRequestException('return_url is not a valid URL');
    }

    if (!allowedHosts.some((re) => re.test(returnHost))) {
      throw new BadRequestException('return_url host is not allowed');
    }

    const checkoutUrl = await this.billingService.createExternalCheckout(
      query.user_id,
      query.plan,
      query.return_url,
      query.product,
    );

    return reply.status(302).redirect(checkoutUrl);
  }

  /**
   * Initiate upgrade to premium subscription
   * Supports external app integration (e.g., Enclii) via orgId parameter
   */
  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate upgrade to premium subscription' })
  @ApiCreatedResponse({ description: 'Checkout session created successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  async upgradeToPremium(@Req() req: any, @Body() dto: UpgradeToPremiumDto) {
    return this.billingService.upgradeToPremium(req.user.id, {
      orgId: dto.orgId,
      plan: dto.plan,
      product: dto.product,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      countryCode: dto.countryCode,
    });
  }

  /**
   * Create billing portal session for subscription management
   */
  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create billing portal session for subscription management' })
  @ApiCreatedResponse({ description: 'Portal session created successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async createPortalSession(@Req() req: any) {
    return this.billingService.createPortalSession(req.user.id);
  }

  /**
   * Get current usage metrics for the authenticated user
   */
  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current usage metrics for the authenticated user' })
  @ApiOkResponse({ description: 'Usage metrics retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getUsage(@Req() req: any) {
    return this.billingService.getUserUsage(req.user.id);
  }

  /**
   * Get billing history for the authenticated user
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get billing history for the authenticated user' })
  @ApiOkResponse({ description: 'Billing history retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getBillingHistory(@Req() req: any) {
    return this.billingService.getBillingHistory(req.user.id);
  }

  /**
   * Get subscription status for the authenticated user
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get subscription status for the authenticated user' })
  @ApiOkResponse({ description: 'Subscription status retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getSubscriptionStatus(@Req() req: any) {
    const user = req.user;

    return {
      tier: user.subscriptionTier,
      startedAt: user.subscriptionStartedAt,
      expiresAt: user.subscriptionExpiresAt,
      isActive:
        user.subscriptionTier !== 'community' &&
        (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date()),
    };
  }

  /**
   * Stripe webhook handler
   * This endpoint receives events from Stripe and processes them
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiOkResponse({ description: 'Webhook processed successfully' })
  @ApiBadRequestResponse({ description: 'Invalid webhook signature or payload' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string
  ) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET not configured');
      return { received: false, error: 'Webhook secret not configured' };
    }

    let event: any;

    try {
      // Verify webhook signature
      event = this.stripeService.constructWebhookEvent(
        (req.rawBody || req.body) as Buffer,
        signature,
        webhookSecret
      );
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return { received: false, error: 'Invalid signature' };
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    try {
      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
          await this.billingService.handleSubscriptionCreated(event);
          break;

        case 'customer.subscription.updated':
          await this.billingService.handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await this.billingService.handleSubscriptionCancelled(event);
          break;

        case 'invoice.payment_succeeded':
          await this.billingService.handlePaymentSucceeded(event);
          break;

        case 'invoice.payment_failed':
          await this.billingService.handlePaymentFailed(event);
          break;

        case 'checkout.session.completed':
          await this.billingService.handleCheckoutCompleted(event);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      return { received: false, error: error.message };
    }

    return { received: true };
  }

  /**
   * Janua webhook handler
   * Receives billing events from Janua's centralized billing system
   * Supports: Conekta (MX), Polar (International), Stripe (fallback)
   */
  @Post('webhook/janua')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Janua billing webhook events' })
  @ApiOkResponse({ description: 'Webhook processed successfully' })
  @ApiBadRequestResponse({ description: 'Invalid webhook signature or payload' })
  async handleJanuaWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-janua-signature') signature: string,
    @Body() payload: JanuaWebhookPayloadDto
  ) {
    // Verify webhook signature
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    if (!this.januaBillingService.verifyWebhookSignature(rawBody, signature || '')) {
      this.logger.error('Janua webhook signature verification failed');
      return { received: false, error: 'Invalid signature' };
    }

    this.logger.log(
      `Received Janua webhook: ${payload.type} from provider ${payload.data.provider}`
    );

    try {
      switch (payload.type) {
        case JanuaWebhookEventType.SUBSCRIPTION_CREATED:
          await this.billingService.handleJanuaSubscriptionCreated(payload);
          break;

        case JanuaWebhookEventType.SUBSCRIPTION_UPDATED:
          await this.billingService.handleJanuaSubscriptionUpdated(payload);
          break;

        case JanuaWebhookEventType.SUBSCRIPTION_CANCELLED:
          await this.billingService.handleJanuaSubscriptionCancelled(payload);
          break;

        case JanuaWebhookEventType.SUBSCRIPTION_PAUSED:
          await this.billingService.handleJanuaSubscriptionPaused(payload);
          break;

        case JanuaWebhookEventType.SUBSCRIPTION_RESUMED:
          await this.billingService.handleJanuaSubscriptionResumed(payload);
          break;

        case JanuaWebhookEventType.PAYMENT_SUCCEEDED:
          await this.billingService.handleJanuaPaymentSucceeded(payload);
          break;

        case JanuaWebhookEventType.PAYMENT_FAILED:
          await this.billingService.handleJanuaPaymentFailed(payload);
          break;

        case JanuaWebhookEventType.PAYMENT_REFUNDED:
          await this.billingService.handleJanuaPaymentRefunded(payload);
          break;

        default:
          this.logger.log(`Unhandled Janua event type: ${payload.type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing Janua webhook: ${error.message}`, error.stack);
      return { received: false, error: error.message };
    }

    return { received: true, event: payload.type };
  }
}
