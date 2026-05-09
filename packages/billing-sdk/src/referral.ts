import { DhanamApiError, DhanamAuthError } from './errors';
import type { AmbassadorProfile, ReferralReward } from './types';
import { stripTrailingSlashes } from './url';

/**
 * Configuration for the referral client.
 */
export interface ReferralClientConfig {
  /** Base URL of the Dhanam API (e.g. "https://api.dhan.am") */
  baseUrl: string;

  /**
   * Async function that returns a fresh JWT access token.
   * Required for authenticated endpoints.
   */
  getAccessToken: () => Promise<string>;

  /** Optional custom fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch;
}

/**
 * Typed HTTP client for the Dhanam referral rewards API.
 *
 * Used by product frontends to display reward history and ambassador profiles.
 * Authenticates via JWT.
 *
 * Funnel operations (code generation, validation, application, stats) have
 * moved to PhyndCRM. This client retains only reward and ambassador queries.
 *
 * @example
 * ```ts
 * const referrals = new DhanamReferralClient({
 *   baseUrl: 'https://api.dhan.am',
 *   getAccessToken: () => auth.getToken(),
 * });
 *
 * const rewards = await referrals.getRewards();
 * const profile = await referrals.getAmbassadorProfile();
 * ```
 */
export class DhanamReferralClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string>;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config: ReferralClientConfig) {
    this.baseUrl = stripTrailingSlashes(config.baseUrl);
    this.getAccessToken = config.getAccessToken;
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  /**
   * Get all rewards earned by the current user through referrals.
   */
  async getRewards(): Promise<ReferralReward[]> {
    return this.request<ReferralReward[]>('GET', '/v1/referral/rewards');
  }

  /**
   * Get the current user's ambassador profile.
   */
  async getAmbassadorProfile(): Promise<AmbassadorProfile> {
    return this.request<AmbassadorProfile>('GET', '/v1/referral/ambassador');
  }

  // ────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

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
        throw new DhanamAuthError(`Authentication failed: ${res.statusText}`, parsed);
      }

      throw new DhanamApiError(
        `Dhanam referral API error: ${res.status} ${res.statusText}`,
        res.status,
        parsed
      );
    }

    return (await res.json()) as T;
  }
}
