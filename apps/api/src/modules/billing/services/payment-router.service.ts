/**
 * =============================================================================
 * Payment Router Service (Hybrid Strategy)
 * =============================================================================
 * Routes payments to the optimal provider based on customer geography:
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    HYBRID PAYMENT ROUTER                        │
 * ├─────────────────────────────────────────────────────────────────┤
 * │                                                                  │
 * │    Customer Country                                             │
 * │           │                                                      │
 * │           ▼                                                      │
 * │    ┌──────┴──────┐                                              │
 * │    │   Mexico?   │                                              │
 * │    └──────┬──────┘                                              │
 * │       YES │  NO                                                  │
 * │           │                                                      │
 * │     ┌─────▼─────┐    ┌──────────────┐                          │
 * │     │ Stripe MX │    │   Paddle     │                          │
 * │     │  (MXN)    │    │  (MoR/USD)   │                          │
 * │     └───────────┘    └──────────────┘                          │
 * │                                                                  │
 * │  Payment Methods:     Payment Methods:                          │
 * │  - Cards              - Cards (global)                          │
 * │  - OXXO               - PayPal                                  │
 * │  - SPEI               - Apple Pay                               │
 * │                       - Google Pay                              │
 * │                                                                  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Benefits:
 * - Native MXN pricing for Mexican customers (no FX fees)
 * - Local payment methods (OXXO cash, SPEI bank transfer)
 * - Paddle as Merchant of Record for global (tax compliance)
 * - Automatic routing based on geography
 * =============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '@core/prisma/prisma.service';

import { PaymentGatewayRegistry } from '../gateways/payment-gateway.registry';

import { PaddleService } from './paddle.service';
import { StripeMxService } from './stripe-mx.service';

export type PaymentProvider = 'stripe_mx' | 'paddle';

export interface CreateCheckoutParams {
  userId: string;
  priceId: string;
  countryCode: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  provider: PaymentProvider;
  currency: string;
}

export interface ProviderConfig {
  provider: PaymentProvider;
  currency: string;
  paymentMethods: string[];
  taxHandling: 'automatic' | 'manual';
}

@Injectable()
export class PaymentRouterService {
  private readonly logger = new Logger(PaymentRouterService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private stripeMx: StripeMxService,
    private paddle: PaddleService,
    private gatewayRegistry: PaymentGatewayRegistry
  ) {
    this.logger.log('Payment Router initialized (Hybrid Strategy: Stripe MX + Paddle)');
  }

  /**
   * Determine the best payment provider for a country
   */
  getProviderForCountry(countryCode: string): ProviderConfig {
    const gatewayId = this.gatewayRegistry.resolveHybridCheckoutGateway(countryCode);
    if (gatewayId === 'stripe_mx') {
      const config = this.gatewayRegistry.require('stripe_mx').getProviderConfig?.(countryCode);
      return {
        provider: 'stripe_mx',
        currency: config?.currency ?? 'MXN',
        paymentMethods: config?.paymentMethods ?? ['card', 'oxxo', 'customer_balance'],
        taxHandling: 'automatic',
      };
    }

    const paddleConfig = this.gatewayRegistry.require('paddle').getProviderConfig?.(countryCode);
    return {
      provider: 'paddle',
      currency: paddleConfig?.currency ?? 'USD',
      paymentMethods: paddleConfig?.paymentMethods ?? ['card', 'paypal', 'apple_pay', 'google_pay'],
      taxHandling: 'automatic',
    };
  }

  /**
   * Create a checkout session using the appropriate provider
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const { userId, priceId, countryCode, successUrl, cancelUrl, metadata } = params;

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        paddleCustomerId: true,
        countryCode: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Determine provider based on country
    const providerConfig = this.getProviderForCountry(countryCode);

    this.logger.log(
      `Routing checkout for ${user.email} to ${providerConfig.provider} (${countryCode})`
    );

    // Route to appropriate provider
    if (providerConfig.provider === 'stripe_mx') {
      return this.createStripeCheckout(user, priceId, successUrl, cancelUrl, metadata);
    } else {
      return this.createPaddleCheckout(user, priceId, countryCode, successUrl, cancelUrl, metadata);
    }
  }

  /**
   * Create Stripe MX checkout session
   */
  private async createStripeCheckout(
    user: { id: string; email: string; name: string | null; stripeCustomerId: string | null },
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<CheckoutResult> {
    if (!this.stripeMx.isConfigured()) {
      throw new Error('Stripe MX not configured');
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeMx.createCustomer({
        email: user.email,
        name: user.name || undefined,
        metadata: { dhanam_user_id: user.id },
      });

      customerId = customer.id;

      // Save customer ID
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          stripeCustomerId: customerId,
          billingProvider: 'stripe_mx',
          countryCode: 'MX',
        },
      });
    }

    // Create checkout session via gateway adapter
    const gateway = this.gatewayRegistry.require('stripe_mx');
    const checkout = await gateway.createSubscriptionCheckout!({
      customerId,
      customerEmail: user.email,
      customerName: user.name || undefined,
      priceId,
      countryCode: 'MX',
      successUrl: `${successUrl}?provider=stripe_mx&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl,
      metadata: {
        ...metadata,
        dhanam_user_id: user.id,
      },
    });

    return {
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.sessionId,
      provider: 'stripe_mx',
      currency: checkout.currency,
    };
  }

  /**
   * Create Paddle checkout transaction
   */
  private async createPaddleCheckout(
    user: { id: string; email: string; name: string | null; paddleCustomerId: string | null },
    priceId: string,
    countryCode: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<CheckoutResult> {
    if (!this.paddle.isConfigured()) {
      throw new Error('Paddle not configured');
    }

    // Create or retrieve Paddle customer
    let customerId = user.paddleCustomerId;
    if (!customerId) {
      const customer = await this.paddle.createCustomer({
        email: user.email,
        name: user.name || undefined,
        countryCode,
        metadata: { dhanam_user_id: user.id },
      });

      customerId = customer.customerId;

      // Save customer ID
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          paddleCustomerId: customerId,
          billingProvider: 'paddle',
          countryCode: countryCode,
        },
      });
    }

    const gateway = this.gatewayRegistry.require('paddle');
    const checkout = await gateway.createSubscriptionCheckout!({
      customerId,
      customerEmail: user.email,
      customerName: user.name || undefined,
      priceId,
      countryCode,
      successUrl: `${successUrl}?provider=paddle&transaction_id={transaction_id}`,
      cancelUrl,
      metadata: {
        ...metadata,
        dhanam_user_id: user.id,
      },
    });

    return {
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.sessionId,
      provider: 'paddle',
      currency: checkout.currency,
    };
  }

  /**
   * Create billing portal session for subscription management
   */
  async createPortalSession(
    userId: string,
    returnUrl: string
  ): Promise<{ portalUrl: string; provider: PaymentProvider }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeCustomerId: true,
        paddleCustomerId: true,
        billingProvider: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Route to the provider the user is subscribed with
    if (user.billingProvider === 'stripe_mx' && user.stripeCustomerId) {
      const session = await this.stripeMx.createPortalSession({
        customerId: user.stripeCustomerId,
        returnUrl,
      });
      return { portalUrl: session.url, provider: 'stripe_mx' };
    }

    if (user.billingProvider === 'paddle' && user.paddleCustomerId) {
      // Paddle doesn't have a portal - redirect to subscription page
      const portalUrl = `${returnUrl}?manage=paddle`;
      return { portalUrl, provider: 'paddle' };
    }

    throw new Error('User has no active billing provider');
  }

  /**
   * Cancel subscription via the appropriate provider
   */
  async cancelSubscription(userId: string, immediate: boolean = false): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        paddleSubscriptionId: true,
        billingProvider: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.billingProvider === 'stripe_mx' && user.stripeSubscriptionId) {
      await this.stripeMx.cancelSubscription(user.stripeSubscriptionId, immediate);
    } else if (user.billingProvider === 'paddle' && user.paddleSubscriptionId) {
      await this.paddle.cancelSubscription(user.paddleSubscriptionId, immediate);
    } else {
      throw new Error('No active subscription found');
    }

    this.logger.log(`Cancelled subscription for user ${userId} via ${user.billingProvider}`);
  }

  /**
   * Get available plans with localized pricing
   */
  getPlans(countryCode: string): Array<{
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    features: string[];
    provider: PaymentProvider;
  }> {
    const isMexico = countryCode === 'MX';
    const provider = this.getProviderForCountry(countryCode).provider;

    return [
      {
        id: 'community',
        name: isMexico ? 'Comunidad' : 'Community',
        price: 0,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'month',
        features: isMexico
          ? [
              'Espacios ilimitados (BYOK)',
              'Simulaciones y ESG ilimitados',
              'Todas las funciones incluidas',
              'Auto-hospedaje — trae tus propias claves',
              'Soporte comunitario',
            ]
          : [
              'Unlimited spaces (BYOK)',
              'Unlimited simulations & ESG',
              'All features included',
              'Self-hosted — bring your own keys',
              'Community support',
            ],
        provider,
      },
      {
        id: 'essentials_monthly',
        name: 'Essentials',
        price: isMexico ? 79 : 4.99,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'month',
        features: isMexico
          ? [
              '20 cálculos ESG por día',
              '10 simulaciones Monte Carlo por día',
              'Categorización IA (ML)',
              '2 espacios',
              'Conexiones Belvo + Bitso',
              '500 MB almacenamiento',
              'Soporte por email (48hr)',
            ]
          : [
              '20 ESG calculations per day',
              '10 Monte Carlo simulations per day',
              'AI categorization (ML loop)',
              '2 spaces',
              'Belvo + Bitso connections',
              '500 MB storage',
              'Email support (48hr SLA)',
            ],
        provider,
      },
      {
        id: 'essentials_yearly',
        name: isMexico ? 'Essentials Anual' : 'Essentials Annual',
        price: isMexico ? 799 : 49.99,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'year',
        features: isMexico
          ? ['Todo lo de Essentials mensual', 'Ahorra 17%']
          : ['Everything in Essentials monthly', 'Save 17%'],
        provider,
      },
      {
        id: 'pro_monthly',
        name: 'Pro',
        price: isMexico ? 199 : 11.99,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'month',
        features: isMexico
          ? [
              'Cálculos ESG ilimitados',
              'Simulaciones Monte Carlo ilimitadas',
              'Todas las conexiones de proveedores (7)',
              'DeFi, Zillow, Coleccionables',
              'Life Beat / planificación patrimonial',
              'Vistas del hogar (Tuyo/Mío/Nuestro)',
              '5 espacios, 5 GB almacenamiento',
              'Soporte prioritario (24hr)',
            ]
          : [
              'Unlimited ESG calculations',
              'Unlimited Monte Carlo simulations',
              'All provider connections (7)',
              'DeFi, Zillow, Collectibles',
              'Life Beat / estate planning',
              'Household views (Yours/Mine/Ours)',
              '5 spaces, 5 GB storage',
              'Priority support (24hr SLA)',
            ],
        provider,
      },
      {
        id: 'pro_yearly',
        name: isMexico ? 'Pro Anual' : 'Pro Annual',
        price: isMexico ? 1999 : 119.99,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'year',
        features: isMexico
          ? ['Todo lo de Pro mensual', 'Ahorra 17%']
          : ['Everything in Pro monthly', 'Save 17%'],
        provider,
      },
    ];
  }

  /**
   * Get Paddle client configuration for frontend
   */
  getPaddleClientConfig(): {
    clientToken: string;
    environment: string;
  } | null {
    if (!this.paddle.isConfigured()) {
      return null;
    }

    return {
      clientToken: this.paddle.getClientToken(),
      environment: this.paddle.getEnvironment(),
    };
  }
}
