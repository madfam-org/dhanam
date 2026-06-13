import { DhanamApiError, DhanamAuthError } from './errors';
import type {
  PosChargeRequest,
  PosChargeResult,
  PosClientConfig,
  PosReconciliationSummary,
  PosRefundRequest,
  PosRefundResult,
  PosRouteOverrideRequest,
  PosRoutePreviewRequest,
  PosRoutePreviewResult,
  PosTimelineEntry,
} from './pos-types';
import { stripTrailingSlashes } from './url';

export type {
  PosChargeRequest,
  PosChargeResult,
  PosClientConfig,
  PosReconciliationSummary,
  PosRefundRequest,
  PosRefundResult,
  PosRouteOverrideRequest,
  PosRoutePreviewRequest,
  PosRoutePreviewResult,
  PosTimelineEntry,
} from './pos-types';

/**
 * Platform-admin client for Dhanam internal POS and checkout routing APIs.
 *
 * Requires a platform-admin JWT. Intended for trusted MADFAM internal services
 * and automation — not end-user applications.
 */
export class DhanamPosClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => Promise<string>;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(config: PosClientConfig) {
    this.baseUrl = stripTrailingSlashes(config.baseUrl);
    this.getAccessToken = config.getAccessToken;
    this._fetch = config.fetch ?? globalThis.fetch;
  }

  async previewRoute(body: PosRoutePreviewRequest): Promise<PosRoutePreviewResult> {
    return this.request<PosRoutePreviewResult>('POST', '/v1/admin/billing/route/preview', body);
  }

  async setRouteOverride(body: PosRouteOverrideRequest): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/v1/admin/billing/route/override', body);
  }

  async clearRouteOverride(body: {
    userId: string;
    product?: string;
    reason?: string;
  }): Promise<{ cleared: true }> {
    return this.request<{ cleared: true }>('POST', '/v1/admin/billing/route/override/clear', body);
  }

  async createCharge(body: PosChargeRequest): Promise<PosChargeResult> {
    return this.request<PosChargeResult>('POST', '/v1/admin/billing/pos/charge', body);
  }

  async createRefund(body: PosRefundRequest): Promise<PosRefundResult> {
    return this.request<PosRefundResult>('POST', '/v1/admin/billing/pos/refund', body);
  }

  async getTimeline(correlationId: string): Promise<PosTimelineEntry[]> {
    return this.request<PosTimelineEntry[]>(
      'GET',
      `/v1/admin/billing/pos/timeline/${encodeURIComponent(correlationId)}`
    );
  }

  async getReconciliation(limit = 25): Promise<PosReconciliationSummary> {
    const query = limit !== 25 ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return this.request<PosReconciliationSummary>(
      'GET',
      `/v1/admin/billing/reconciliation${query}`
    );
  }

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

      if (res.status === 401 || res.status === 403) {
        throw new DhanamAuthError(`POS API auth failed: ${res.statusText}`, parsed);
      }

      throw new DhanamApiError(
        `Dhanam POS API error: ${res.status} ${res.statusText}`,
        res.status,
        parsed
      );
    }

    return (await res.json()) as T;
  }
}
