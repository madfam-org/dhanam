/**
 * =============================================================================
 * Dhanam Billing Module
 * =============================================================================
 * Provides multi-provider payment processing for the Galaxy ecosystem.
 *
 * Hybrid Router Strategy:
 * - Mexico (MX): Stripe Mexico (MXN, OXXO, SPEI)
 * - Global: Paddle (Merchant of Record, USD/EUR, PayPal, Apple/Google Pay)
 *
 * This enables optimal payment experience based on customer geography:
 * - Native currency pricing (no FX fees for Mexican users)
 * - Local payment methods (OXXO cash, SPEI bank transfers)
 * - Global tax compliance via Paddle MoR
 * =============================================================================
 */
import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuditModule } from '../../core/audit/audit.module';
import { MonitoringModule } from '../../core/monitoring/monitoring.module';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { EmailModule } from '../email/email.module';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CatalogController } from './catalog.controller';
import { ConektaController } from './conekta.controller';
import { CotizaWebhookController } from './cotiza-webhook.controller';
import { CreditBillingController } from './credit-billing.controller';
import { CustomerFederationController } from './customer-federation.controller';
import { DlqController } from './dlq.controller';
import {
  ConektaGateway,
  JanuaBillingGateway,
  LegacyStripeGateway,
  PaddleGateway,
  PaymentGatewayRegistry,
  StripeMxGateway,
} from './gateways';
import { CatalogApplySecretGuard } from './guards/catalog-apply-secret.guard';
import { FeatureGateGuard } from './guards/feature-gate.guard';
import { FederationAuthGuard } from './guards/federation-auth.guard';
import { ProviderConnectionGuard } from './guards/provider-connection.guard';
import { SpaceLimitGuard } from './guards/space-limit.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { UsageLimitGuard } from './guards/usage-limit.guard';
import { UsageTrackingInterceptor } from './interceptors/usage-tracking.interceptor';
import { InternalCatalogController } from './internal-catalog.controller';
import { JanuaBillingService } from './janua-billing.service';
import { OverageInvoicingJob } from './jobs/overage-invoicing.job';
import { ReconciliationJob } from './jobs/reconciliation.job';
import { SubscriptionLifecycleJob } from './jobs/subscription-lifecycle.job';
import { SyntheticRevenueProbeJob } from './jobs/synthetic-revenue-probe.job';
import { WebhookDlqRetryJob } from './jobs/webhook-dlq-retry.job';
import { MadfamEventsController } from './madfam-events.controller';
// Federation (PhyndCRM integration)
import { CancellationService } from './services/cancellation.service';
import { CheckoutRouteOverrideService } from './services/checkout-route-override.service';
import { CheckoutRoutingPolicyService } from './services/checkout-routing-policy.service';
import { ConektaService } from './services/conekta.service';
import { CustomerFederationService } from './services/customer-federation.service';
// Hybrid Router Services (Stripe MX + Paddle)
import { InternalPosService } from './services/internal-pos.service';
import { OperatorCheckoutStatusService } from './services/operator-checkout-status.service';
import { PaddleService } from './services/paddle.service';
import { PaymentRouterService } from './services/payment-router.service';
import { PhyndCrmEngagementNotifierService } from './services/phyndcrm-engagement-notifier.service';
import { PriceResolverService } from './services/price-resolver.service';
import { PricingEngineService } from './services/pricing-engine.service';
import { ProductCatalogService } from './services/product-catalog.service';
import { RevenueMetricsService } from './services/revenue-metrics.service';
import { StripeMxSpeiRelayService } from './services/stripe-mx-spei-relay.service';
import { StripeMxService } from './services/stripe-mx.service';
import { SubscriptionJanuaNotifierService } from './services/subscription-janua-notifier.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SyntheticRevenueProbeService } from './services/synthetic-revenue-probe.service';
import { TrialService } from './services/trial.service';
import { UsageAlertsService } from './services/usage-alerts.service';
import { UsageMeteringService } from './services/usage-metering.service';
import { UsageTrackingService } from './services/usage-tracking.service';
import { WebhookDlqService } from './services/webhook-dlq.service';
// Extracted sub-services (usage, lifecycle, webhooks)
import { WebhookProcessorService } from './services/webhook-processor.service';
import { StripeMxController } from './stripe-mx.controller';
import { StripeService } from './stripe.service';
// Waybill → Dhanam alert pipeline (P2.2)
import { UsageAlertsController } from './usage-alerts.controller';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    // forwardRef breaks the indirect circular dep:
    //   BillingModule → EmailModule → AnalyticsModule (@Global)
    //     → SpacesModule → BillingModule
    // EmailService is consumed only at provider level (UsageAlertsService),
    // so deferring the module-graph edge is safe. Added 2026-05-04 to fix
    // the prod CrashLoopBackOff that pinned us to sha256:99f148de (#413).
    forwardRef(() => EmailModule),
    // MonitoringModule provides the 'SentryService' string token used
    // by WebhookDlqService for per-failure structured Sentry events.
    MonitoringModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [
    BillingController,
    InternalCatalogController,
    ConektaController,
    CreditBillingController,
    CustomerFederationController,
    CatalogController,
    CotizaWebhookController,
    DlqController,
    MadfamEventsController,
    StripeMxController,
    UsageAlertsController,
  ],
  providers: [
    // Core billing services
    BillingService,
    JanuaBillingService,
    StripeService,

    // Extracted sub-services
    UsageMeteringService,
    UsageTrackingService,
    CheckoutRoutingPolicyService,
    CheckoutRouteOverrideService,
    InternalPosService,
    OperatorCheckoutStatusService,
    SubscriptionJanuaNotifierService,
    SubscriptionLifecycleService,
    WebhookProcessorService,

    // Product catalog
    ProductCatalogService,

    // Cancellation pipeline
    CancellationService,

    // Revenue analytics
    RevenueMetricsService,

    // Waybill alert ingest (P2.2)
    UsageAlertsService,

    // Pricing & trial lifecycle
    PriceResolverService,
    PricingEngineService,
    TrialService,
    SubscriptionLifecycleJob,
    ReconciliationJob,
    OverageInvoicingJob,

    // Synthetic revenue probe — production-only smoke test for the
    // Stripe → Dhanam → consumer fan-out path. See
    // services/synthetic-revenue-probe.service.ts for design rationale.
    SyntheticRevenueProbeService,
    SyntheticRevenueProbeJob,

    // Webhook DLQ + auto-retry (Karafiel/Tezca CFDI safety net).
    // Captures failed downstream deliveries from the Stripe MX SPEI
    // relay + the subscription product-webhook fan-out, with both
    // an auto-retry cron job and an admin manual-replay endpoint.
    WebhookDlqService,
    WebhookDlqRetryJob,

    // Hybrid Router (Stripe MX + Paddle + Conekta direct)
    PaymentRouterService,
    StripeMxService,
    StripeMxSpeiRelayService,
    PhyndCrmEngagementNotifierService,
    PaddleService,
    // Payment gateway adapters (ADR-008 — single port for all PSPs)
    StripeMxGateway,
    PaddleGateway,
    ConektaGateway,
    JanuaBillingGateway,
    LegacyStripeGateway,
    PaymentGatewayRegistry,
    // Conekta direct gateway (Wave A — alongside Stripe MX, distinct from
    // Janua-routed Conekta path in JanuaBillingService)
    ConektaService,

    // Federation (PhyndCRM)
    CustomerFederationService,
    FederationAuthGuard,

    // Guards and interceptors
    SubscriptionGuard,
    UsageLimitGuard,
    CatalogApplySecretGuard,
    SpaceLimitGuard,
    ProviderConnectionGuard,
    FeatureGateGuard,
    UsageTrackingInterceptor,
  ],
  exports: [
    BillingService,
    JanuaBillingService,
    StripeService,
    PriceResolverService,
    PricingEngineService,
    TrialService,
    PaymentRouterService,
    StripeMxService,
    StripeMxSpeiRelayService,
    PaddleService,
    ConektaService,
    CustomerFederationService,
    UsageMeteringService,
    UsageTrackingService,
    CheckoutRoutingPolicyService,
    CheckoutRouteOverrideService,
    InternalPosService,
    OperatorCheckoutStatusService,
    SubscriptionJanuaNotifierService,
    SubscriptionLifecycleService,
    WebhookDlqService,
    WebhookProcessorService,
    SubscriptionGuard,
    UsageLimitGuard,
    SpaceLimitGuard,
    ProviderConnectionGuard,
    FeatureGateGuard,
    UsageTrackingInterceptor,
    ProductCatalogService,
    CancellationService,
    UsageAlertsService,
    PaymentGatewayRegistry,
  ],
})
export class BillingModule {}
