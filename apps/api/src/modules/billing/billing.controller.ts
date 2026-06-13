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
import type Stripe from 'stripe';

import { SubscriptionTier } from '@db';

import { Roles } from '../../core/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { ThrottleAuthGuard } from '../../core/security/guards/throttle-auth.guard';
import { AuthenticatedRequest } from '../../core/types/authenticated-request';

import { BillingService } from './billing.service';
import { CheckoutRouteRecommendationQueryDto } from './dto/checkout-route-recommendation.dto';
import type { PaymentInstrumentId } from './config/payment-route-fee-schedule';
import { CheckoutQueryDto, StartTrialDto, UpgradeToPremiumDto } from './dto';
import { CancelConfirmDto } from './dto/cancel-confirm.dto';
import { CancelIntentDto } from './dto/cancel-intent.dto';
import { JanuaWebhookPayloadDto, JanuaWebhookEventType } from './dto/janua-webhook.dto';
import { PauseSubscriptionDto } from './dto/pause-subscription.dto';
import { JanuaBillingService } from './janua-billing.service';
import { CancellationService } from './services/cancellation.service';
import { CheckoutRoutingPolicyService } from './services/checkout-routing-policy.service';
import { PricingEngineService } from './services/pricing-engine.service';
import { RevenueMetricsService } from './services/revenue-metrics.service';
import { TrialService } from './services/trial.service';
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
    private pricingEngine: PricingEngineService,
    private trialService: TrialService,
    private cancellationService: CancellationService,
    private revenueMetricsService: RevenueMetricsService,
    private checkoutRouting: CheckoutRoutingPolicyService,
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
    const allowedHosts = [/\.madfam\.io$/, /\.dhan\.am$/, /\.enclii\.dev$/, /\.enclii\.com$/];

    // Env-driven allowlist: CHECKOUT_ALLOWED_HOSTS=karafiel.mx,tezca.mx,janua.dev
    // New ecosystem services add their custom domain here without code changes.
    const envHosts = (process.env.CHECKOUT_ALLOWED_HOSTS || '').split(',').filter(Boolean);
    for (const h of envHosts) {
      // Escape ALL regex metacharacters (not just '.') so a misconfigured env
      // value can't smuggle alternation or character classes into the matcher.
      const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      allowedHosts.push(new RegExp(`(^|\\.)${escaped}$`));
    }

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
      query.product
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
  async upgradeToPremium(@Req() req: AuthenticatedRequest, @Body() dto: UpgradeToPremiumDto) {
    return this.billingService.upgradeToPremium(req.user.id, {
      orgId: dto.orgId,
      plan: dto.plan,
      product: dto.product,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      countryCode: dto.countryCode,
      paymentMethod: dto.paymentMethod,
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
  async createPortalSession(@Req() req: AuthenticatedRequest) {
    return this.billingService.createPortalSession(req.user.id);
  }

  // ─── Cancellation-Intent Reengagement Pipeline ─────────────────

  @Post('cancel-intent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start cancellation flow — collects reason, returns save offer' })
  async startCancelIntent(@Req() req: AuthenticatedRequest, @Body() dto: CancelIntentDto) {
    return this.cancellationService.startCancelIntent(req.user.id, dto.reason, dto.reasonText);
  }

  @Post('cancel-confirm')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Confirm cancellation at period end (after seeing save offer)' })
  async confirmCancellation(@Req() req: AuthenticatedRequest, @Body() dto: CancelConfirmDto) {
    return this.cancellationService.confirmCancellation(req.user.id, dto.intentId);
  }

  @Post('pause')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pause subscription for 1-3 months instead of cancelling' })
  async pauseSubscription(@Req() req: AuthenticatedRequest, @Body() dto: PauseSubscriptionDto) {
    return this.cancellationService.pauseSubscription(req.user.id, dto.months, dto.intentId);
  }

  @Post('save-offer/accept')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Accept retention discount offer' })
  async acceptSaveOffer(@Req() req: AuthenticatedRequest, @Body() body: CancelConfirmDto) {
    return this.cancellationService.applySaveDiscount(req.user.id, body.intentId);
  }

  // ─── Admin Revenue Metrics ────────────────────────────────────

  @Get('admin/revenue-metrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get MRR/ARR/churn metrics (admin only)' })
  @ApiOkResponse({ description: 'Revenue metrics retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getRevenueMetrics() {
    return this.revenueMetricsService.getRevenueMetrics();
  }

  /**
   * Get current usage metrics for the authenticated user
   */
  @Get('usage')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current usage metrics for the authenticated user' })
  @ApiOkResponse({ description: 'Usage metrics retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getUsage(@Req() req: AuthenticatedRequest) {
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
  async getBillingHistory(@Req() req: AuthenticatedRequest) {
    return this.billingService.getBillingHistory(req.user.id);
  }

  /**
   * Get regional pricing for a country.
   * Public endpoint - no auth required.
   */
  @Get('pricing')
  @ApiOperation({ summary: 'Get regional pricing (public, no auth required)' })
  @ApiOkResponse({ description: 'Regional pricing retrieved successfully' })
  async getPricing(@Query('country') country?: string) {
    const countryCode = country || 'US';
    return this.pricingEngine.getPricingForCountry(countryCode);
  }

  /**
   * Fee-aware checkout route recommendation for visitors and upgrade UI.
   * Public — no auth required.
   */
  @Get('checkout/route-recommendation')
  @ApiOperation({
    summary: 'Get fee-optimal checkout route and payment instrument suggestions',
  })
  @ApiOkResponse({ description: 'Route recommendation with fee estimates' })
  getCheckoutRouteRecommendation(@Query() query: CheckoutRouteRecommendationQueryDto) {
    return this.checkoutRouting.getPublicRouteRecommendation({
      countryCode: query.country,
      plan: query.plan,
      product: query.product,
      amountMinor: query.amountMinor,
      currency: query.currency,
      paymentMethod: query.paymentMethod as PaymentInstrumentId | undefined,
    });
  }

  /**
   * Get subscription status for the authenticated user
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get subscription status for the authenticated user' })
  @ApiOkResponse({ description: 'Subscription status retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async getSubscriptionStatus(@Req() req: AuthenticatedRequest) {
    // JWT payload includes subscription fields beyond AuthenticatedUser
    const user = req.user as AuthenticatedRequest['user'] & {
      subscriptionTier: string;
      subscriptionStartedAt: string | null;
      subscriptionExpiresAt: string | null;
      trialTier: string | null;
      trialEndsAt: string | null;
      promoStartedAt: string | null;
      promoEndsAt: string | null;
    };

    // JWT round-trip serializes Dates as ISO strings; coerce back before
    // passing to TrialService methods which expect `Date | null`.
    const toDate = (s: string | null): Date | null => (s ? new Date(s) : null);
    const isInTrial = this.trialService.isInTrial({
      trialTier: user.trialTier,
      trialEndsAt: toDate(user.trialEndsAt),
    });
    const isInPromo = this.trialService.isInPromo({
      promoStartedAt: toDate(user.promoStartedAt),
      promoEndsAt: toDate(user.promoEndsAt),
    });

    return {
      tier: user.subscriptionTier,
      startedAt: user.subscriptionStartedAt,
      expiresAt: user.subscriptionExpiresAt,
      isActive:
        user.subscriptionTier !== 'community' &&
        (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt) > new Date()),
      isInTrial,
      isInPromo,
      trialEndsAt: user.trialEndsAt,
      promoEndsAt: user.promoEndsAt,
    };
  }

  /**
   * Start a free trial.
   */
  @Post('trial/start')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start a free trial' })
  @ApiCreatedResponse({ description: 'Trial started successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async startTrial(@Req() req: AuthenticatedRequest, @Body() dto: StartTrialDto) {
    const tier = dto.plan as SubscriptionTier;
    await this.trialService.startTrial(req.user.id, tier, false);
    return { message: 'Trial started', plan: tier, trialDays: 3 };
  }

  /**
   * Extend trial by adding credit card.
   */
  @Post('trial/extend')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Extend trial with credit card' })
  @ApiCreatedResponse({ description: 'Trial extended successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async extendTrial(@Req() req: AuthenticatedRequest) {
    await this.trialService.extendTrialWithCC(req.user.id);
    return { message: 'Trial extended to 21 days' };
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
      throw new BadRequestException('Webhook not configured');
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripeService.constructWebhookEvent(
        (req.rawBody || req.body) as Buffer,
        signature,
        webhookSecret
      );
    } catch (_error) {
      this.logger.error('Webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
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
      // Fail closed: re-throw so NestJS converts to a 5xx and Stripe retries
      // via its standard retry ladder (24 hours, 3 days, ...).
      // Idempotency in webhook-processor.service.ts (BillingEvent.stripeEventId
      // unique constraint) prevents double-application on retry.
      this.logger.error(`Error processing webhook event ${event.type}`, error.stack);
      throw error;
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
      throw new BadRequestException('Invalid webhook signature');
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
      // Log the error but acknowledge receipt to prevent Janua retries
      this.logger.error(`Error processing Janua webhook event ${payload.type}`, error.stack);
    }

    return { received: true, event: payload.type };
  }
}
