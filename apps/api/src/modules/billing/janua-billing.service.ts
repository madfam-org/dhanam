import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BillingProvider = 'conekta' | 'polar' | 'stripe';

/**
 * Janua Billing Service
 *
 * Integrates with Janua's unified multi-provider billing system for
 * geographic-optimized payment processing across MADFAM ecosystem products.
 *
 * ## Provider Routing Strategy
 * | Country | Provider | Payment Methods | Features |
 * |---------|----------|-----------------|----------|
 * | Mexico  | Conekta  | SPEI, Cards, Cash | CFDI invoicing, MXN |
 * | Others  | Polar.sh | Cards, Digital | Tax compliance (MoR) |
 * | Fallback| Stripe   | Cards, ACH | USD/EUR |
 *
 * ## Architecture
 * ```
 * Dhanam App → JanuaBillingService → Janua API → Provider (Conekta/Polar/Stripe)
 *                                         ↓
 *                              Unified webhooks back to Dhanam
 * ```
 *
 * ## Janua Integration Benefits
 * - Single API for multiple payment providers
 * - Automatic tax compliance (Polar as Merchant of Record)
 * - CFDI invoice generation for Mexico
 * - Unified subscription management
 * - Cross-product billing (Dhanam, Enclii, etc.)
 *
 * ## Configuration
 * - `JANUA_API_URL`: Janua API endpoint (default: http://janua-api:8001)
 * - `JANUA_API_KEY`: API key for authentication
 * - `JANUA_BILLING_ENABLED`: Enable/disable Janua (fallback to Stripe direct)
 * - `JANUA_WEBHOOK_SECRET`: HMAC secret for webhook verification
 *
 * @example
 * ```typescript
 * // Create customer and checkout session
 * const { customerId, provider } = await janua.createCustomer({
 *   email: 'user@example.com',
 *   countryCode: 'MX',
 * });
 *
 * const { checkoutUrl } = await janua.createCheckoutSession({
 *   customerId,
 *   customerEmail: 'user@example.com',
 *   priceId: 'premium',
 *   countryCode: 'MX',
 *   successUrl: 'https://app.dhan.am/billing/success',
 *   cancelUrl: 'https://app.dhan.am/billing/cancel',
 * });
 * ```
 *
 * @see BillingService - Uses Janua for subscription management
 * @see https://auth.madfam.io - Janua OIDC issuer
 */
@Injectable()
export class JanuaBillingService {
  private readonly logger = new Logger(JanuaBillingService.name);
  private readonly januaApiUrl: string;
  private readonly januaApiKey: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.januaApiUrl = this.config.get<string>('JANUA_API_URL', '');
    this.januaApiKey = this.config.get<string>('JANUA_API_KEY', '');
    this.enabled = this.config.get<boolean>('JANUA_BILLING_ENABLED', true);

    if (this.enabled && this.januaApiKey) {
      this.logger.log('Janua billing service initialized');
    } else {
      this.logger.warn('Janua billing disabled - falling back to direct Stripe');
    }
  }

  /**
   * Check if Janua billing is available
   */
  isEnabled(): boolean {
    return this.enabled && !!this.januaApiKey;
  }

  /**
   * Determine the best payment provider for a country
   *
   * Routes to the optimal provider based on:
   * - Local payment methods (SPEI for Mexico)
   * - Tax compliance requirements (Polar handles MoR internationally)
   * - Currency support (MXN via Conekta)
   *
   * @param countryCode - ISO 3166-1 alpha-2 country code
   * @returns Provider identifier for Janua API
   *
   * @example
   * ```typescript
   * janua.getProviderForCountry('MX'); // 'conekta'
   * janua.getProviderForCountry('US'); // 'polar'
   * janua.getProviderForCountry('DE'); // 'polar'
   * ```
   */
  getProviderForCountry(countryCode: string): 'conekta' | 'polar' | 'stripe' {
    // Mexico → Conekta (supports SPEI, cards, CFDI)
    if (countryCode === 'MX') {
      return 'conekta';
    }

    // Digital products / International → Polar.sh
    // Polar handles tax compliance as MoR
    return 'polar';
  }

  /**
   * Create a customer via Janua's unified API
   *
   * Creates a customer record in the appropriate payment provider based on
   * country. Customer IDs are scoped to the provider but unified through Janua.
   *
   * @param params - Customer creation parameters
   * @param params.email - Customer email address
   * @param params.name - Optional customer name
   * @param params.countryCode - ISO country code for provider routing
   * @param params.orgId - Janua organization ID for cross-product linking
   * @param params.metadata - Additional metadata to store with customer
   * @returns Customer ID and provider used
   * @throws Error if Janua billing not enabled or API call fails
   *
   * @example
   * ```typescript
   * const { customerId, provider } = await janua.createCustomer({
   *   email: 'usuario@example.com',
   *   name: 'Juan Pérez',
   *   countryCode: 'MX',
   *   orgId: 'org_dhanam_123',
   * });
   * // customerId: 'cus_conekta_abc123', provider: 'conekta'
   * ```
   */
  async createCustomer(params: {
    email: string;
    name?: string;
    countryCode: string;
    orgId?: string;
    metadata?: Record<string, string>;
  }): Promise<{ customerId: string; provider: BillingProvider }> {
    if (!this.isEnabled()) {
      throw new Error('Janua billing not enabled');
    }

    const provider = this.getProviderForCountry(params.countryCode);

    const response = await fetch(`${this.januaApiUrl}/api/billing/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.januaApiKey}`,
      },
      body: JSON.stringify({
        email: params.email,
        name: params.name,
        country_code: params.countryCode,
        provider,
        organization_id: params.orgId,
        metadata: {
          ...params.metadata,
          product: 'dhanam',
          orgId: params.orgId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Janua customer creation failed: ${error}`);
      throw new Error(`Failed to create customer: ${error}`);
    }

    const data = await response.json();
    this.logger.log(`Created customer via Janua (${provider}): ${data.customer_id}`);

    return {
      customerId: data.customer_id,
      provider,
    };
  }

  /**
   * Create a checkout session via Janua
   *
   * Generates a hosted checkout page URL with provider-specific payment methods.
   * Mexico customers get Conekta (SPEI, cards) while international users get Polar.
   *
   * @param params - Checkout session parameters
   * @param params.customerId - Customer ID from createCustomer
   * @param params.customerEmail - Customer email for receipts
   * @param params.priceId - Dhanam plan ID (e.g., 'premium')
   * @param params.countryCode - ISO country code for provider/currency routing
   * @param params.successUrl - Redirect URL after successful payment
   * @param params.cancelUrl - Redirect URL if user cancels
   * @param params.orgId - Janua organization ID for cross-product linking
   * @param params.metadata - Additional metadata for the session
   * @returns Checkout URL for redirect and session ID for tracking
   * @throws Error if Janua billing not enabled or API call fails
   *
   * @example
   * ```typescript
   * const { checkoutUrl, sessionId, provider } = await janua.createCheckoutSession({
   *   customerId: 'cus_conekta_abc123',
   *   customerEmail: 'usuario@example.com',
   *   priceId: 'premium',
   *   countryCode: 'MX',
   *   successUrl: 'https://app.dhan.am/billing/success?session_id={CHECKOUT_SESSION_ID}',
   *   cancelUrl: 'https://app.dhan.am/billing/cancel',
   * });
   * // Redirect user to checkoutUrl for payment
   * ```
   */
  async createCheckoutSession(params: {
    customerId: string;
    customerEmail: string;
    priceId: string;
    countryCode: string;
    successUrl: string;
    cancelUrl: string;
    orgId?: string;
    metadata?: Record<string, string>;
  }): Promise<{ checkoutUrl: string; sessionId: string; provider: BillingProvider }> {
    if (!this.isEnabled()) {
      throw new Error('Janua billing not enabled');
    }

    const provider = this.getProviderForCountry(params.countryCode);

    const response = await fetch(`${this.januaApiUrl}/api/billing/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.januaApiKey}`,
      },
      body: JSON.stringify({
        customer_id: params.customerId,
        customer_email: params.customerEmail,
        plan_id: `dhanam_${params.priceId}`,
        country_code: params.countryCode,
        provider,
        organization_id: params.orgId,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          ...params.metadata,
          product: 'dhanam',
          orgId: params.orgId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Janua checkout creation failed: ${error}`);
      throw new Error(`Failed to create checkout: ${error}`);
    }

    const data = await response.json();
    this.logger.log(`Created checkout session via Janua (${provider}): ${data.session_id}`);

    return {
      checkoutUrl: data.checkout_url,
      sessionId: data.session_id,
      provider,
    };
  }

  /**
   * Create a billing portal session via Janua
   *
   * Generates a customer-facing portal URL where users can manage their
   * subscription, update payment methods, view invoices, and cancel.
   *
   * @param params - Portal session parameters
   * @param params.customerId - Customer ID to create portal for
   * @param params.countryCode - Country for provider routing
   * @param params.returnUrl - URL to return to after portal session
   * @returns Portal URL for redirect
   * @throws Error if Janua billing not enabled or API call fails
   */
  async createPortalSession(params: {
    customerId: string;
    countryCode: string;
    returnUrl: string;
  }): Promise<{ portalUrl: string }> {
    if (!this.isEnabled()) {
      throw new Error('Janua billing not enabled');
    }

    const provider = this.getProviderForCountry(params.countryCode);

    const response = await fetch(`${this.januaApiUrl}/api/billing/portal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.januaApiKey}`,
      },
      body: JSON.stringify({
        customer_id: params.customerId,
        provider,
        return_url: params.returnUrl,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Janua portal creation failed: ${error}`);
      throw new Error(`Failed to create portal session: ${error}`);
    }

    const data = await response.json();
    return { portalUrl: data.portal_url };
  }

  /**
   * Cancel a subscription via Janua
   *
   * Cancels an active subscription. By default, cancels at end of billing period.
   * Set immediate=true to cancel immediately (prorated refund depends on provider).
   *
   * @param params - Cancellation parameters
   * @param params.subscriptionId - Subscription to cancel
   * @param params.provider - Provider the subscription is on
   * @param params.immediate - Cancel immediately vs end of period (default: false)
   * @throws Error if Janua billing not enabled or API call fails
   */
  async cancelSubscription(params: {
    subscriptionId: string;
    provider: string;
    immediate?: boolean;
  }): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Janua billing not enabled');
    }

    const response = await fetch(
      `${this.januaApiUrl}/api/billing/subscriptions/${params.subscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.januaApiKey}`,
        },
        body: JSON.stringify({
          provider: params.provider,
          immediate: params.immediate ?? false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Janua subscription cancellation failed: ${error}`);
      throw new Error(`Failed to cancel subscription: ${error}`);
    }

    this.logger.log(`Cancelled subscription via Janua: ${params.subscriptionId}`);
  }

  /**
   * Get available plans with localized pricing
   *
   * Returns Dhanam subscription plans with pricing in local currency.
   * Mexico gets MXN pricing, all others get USD.
   *
   * @param countryCode - ISO country code for currency selection
   * @returns Array of plans with features and localized pricing
   *
   * @example
   * ```typescript
   * const plans = await janua.getPlans('MX');
   * // [
   * //   { id: 'free', price: 0, currency: 'MXN', ... },
   * //   { id: 'premium', price: 499, currency: 'MXN', ... }
   * // ]
   * ```
   */
  async getPlans(countryCode: string): Promise<
    Array<{
      id: string;
      name: string;
      price: number;
      currency: string;
      interval: string;
      features: string[];
    }>
  > {
    const isMexico = countryCode === 'MX';

    // Dhanam plans
    return [
      {
        id: 'community',
        name: 'Community',
        price: 0,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'month',
        features: [
          '5 ESG calculations/day',
          '2 Monte Carlo simulations/day',
          '1 space (personal)',
          '500 API requests/day',
          'Community support',
        ],
      },
      {
        id: 'essentials',
        name: 'Essentials',
        price: isMexico ? 79 : 4.99,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'month',
        features: [
          '20 ESG calculations/day',
          '10 Monte Carlo simulations/day',
          'AI categorization (ML learning loop)',
          '2 spaces (personal + business)',
          'Belvo + Bitso connections',
          '500 MB document storage',
          'Email support (48hr SLA)',
        ],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: isMexico ? 199 : 11.99,
        currency: isMexico ? 'MXN' : 'USD',
        interval: 'month',
        features: [
          'Unlimited ESG calculations',
          'Unlimited Monte Carlo simulations',
          'All provider connections (7)',
          'DeFi tracking (50+ protocols)',
          'Collectibles valuation',
          'Life Beat / estate planning',
          'Household views (Yours/Mine/Ours)',
          '5 spaces, 5 GB storage',
          'Priority support (24hr SLA)',
        ],
      },
    ];
  }

  /**
   * Verify webhook signature from Janua
   *
   * Uses HMAC-SHA256 with timing-safe comparison to prevent timing attacks.
   * Should be called for every webhook before processing the payload.
   *
   * @param payload - Raw request body as string
   * @param signature - X-Janua-Signature header value
   * @returns True if signature is valid
   *
   * @example
   * ```typescript
   * app.post('/webhooks/janua', (req, res) => {
   *   const isValid = janua.verifyWebhookSignature(
   *     req.rawBody,
   *     req.headers['x-janua-signature']
   *   );
   *   if (!isValid) {
   *     return res.status(401).send('Invalid signature');
   *   }
   *   // Process webhook...
   * });
   * ```
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.config.get<string>('JANUA_WEBHOOK_SECRET', '');

    if (!webhookSecret) {
      this.logger.warn('JANUA_WEBHOOK_SECRET not configured');
      return false;
    }

    // Janua uses HMAC-SHA256 for webhook signatures
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}
