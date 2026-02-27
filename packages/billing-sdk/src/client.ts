import { DhanamApiError, DhanamAuthError } from './errors';
import type {
  BillingHistory,
  CheckoutOptions,
  CheckoutResult,
  DhanamClientConfig,
  PortalResult,
  SubscriptionStatus,
  UpgradeOptions,
  UsageMetrics,
} from './types';

/**
 * Typed HTTP client for the Dhanam billing API.
 *
 * Uses native `fetch` — zero runtime dependencies.
 *
 * @example
 * ```ts
 * const dhanam = new DhanamClient({
 *   baseUrl: 'https://api.dhan.am',
 *   token: 'eyJ…',
 * });
 *
 * const { checkoutUrl } = await dhanam.upgrade({ plan: 'pro' });
 * ```
 */
export class DhanamClient {
  private readonly baseUrl: string;
  private readonly tokenOrFn: string | (() => string | Promise<string>) | undefined;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config: DhanamClientConfig) {
    // Strip trailing slash
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.tokenOrFn = config.token;
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  // ────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────

  /**
   * Build a public checkout redirect URL (no auth required).
   * This constructs the URL locally — no network request is made.
   */
  buildCheckoutUrl(opts: CheckoutOptions): string {
    const params = new URLSearchParams({
      plan: opts.plan,
      user_id: opts.userId,
      return_url: opts.returnUrl,
    });
    if (opts.product) {
      params.set('product', opts.product);
    }
    return `${this.baseUrl}/billing/checkout?${params.toString()}`;
  }

  /**
   * Initiate a premium upgrade. Requires authentication.
   * Returns a checkout URL and the selected payment provider.
   */
  async upgrade(opts: UpgradeOptions = {}): Promise<CheckoutResult> {
    return this.request<CheckoutResult>('POST', '/billing/upgrade', opts);
  }

  /** Get the current subscription status. Requires authentication. */
  async getStatus(): Promise<SubscriptionStatus> {
    return this.request<SubscriptionStatus>('GET', '/billing/status');
  }

  /** Get current billing-period usage metrics. Requires authentication. */
  async getUsage(): Promise<UsageMetrics> {
    return this.request<UsageMetrics>('GET', '/billing/usage');
  }

  /** Get billing event history. Requires authentication. */
  async getHistory(): Promise<BillingHistory> {
    return this.request<BillingHistory>('GET', '/billing/history');
  }

  /** Create a billing portal session for self-service management. Requires authentication. */
  async createPortalSession(): Promise<PortalResult> {
    return this.request<PortalResult>('POST', '/billing/portal');
  }

  // ────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────

  private async resolveToken(): Promise<string | undefined> {
    if (typeof this.tokenOrFn === 'function') {
      return this.tokenOrFn();
    }
    return this.tokenOrFn;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = await this.resolveToken();

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await this._fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let parsed: unknown;
      try {
        parsed = await res.json();
      } catch {
        parsed = await res.text().catch(() => undefined);
      }

      if (res.status === 401) {
        throw new DhanamAuthError(
          `Authentication failed: ${res.statusText}`,
          parsed,
        );
      }

      throw new DhanamApiError(
        `Dhanam API error: ${res.status} ${res.statusText}`,
        res.status,
        parsed,
      );
    }

    return (await res.json()) as T;
  }
}
