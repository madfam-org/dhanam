import { apiClient } from './client';

// Types
export interface SystemStats {
  users: {
    total: number;
    verified: number;
    withTotp: number;
    active30Days: number;
  };
  spaces: {
    total: number;
    personal: number;
    business: number;
  };
  accounts: {
    total: number;
    connected: number;
    byProvider: Record<string, number>;
  };
  transactions: {
    total: number;
    last30Days: number;
    categorized: number;
  };
}

export interface UserSearchParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'email' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface UserDetails {
  id: string;
  email: string;
  name: string;
  locale: string;
  timezone: string;
  totpEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  spaces: Array<{
    id: string;
    name: string;
    type: 'personal' | 'business';
    role: string;
    createdAt: string;
  }>;
  accountsCount: number;
  transactionsCount: number;
  lastActivity: string | null;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogSearchParams {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface OnboardingFunnel {
  total: number;
  steps: Array<{
    step: string;
    count: number;
    percentage: number;
  }>;
  completion: {
    rate: number;
    averageTimeMinutes: number;
  };
  dropoff: Array<{
    fromStep: string;
    toStep: string;
    count: number;
    percentage: number;
  }>;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage?: number;
  targetedUsers?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiPaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function normalizePaginated<T>(
  response: PaginatedResponse<T> | ApiPaginatedResponse<T>
): PaginatedResponse<T> {
  if ('meta' in response) {
    return {
      data: response.data,
      total: response.meta.total,
      page: response.meta.page,
      limit: response.meta.limit,
      totalPages: response.meta.totalPages,
    };
  }

  return response;
}

// Phase 5 types
export interface SystemHealth {
  database: { status: string; connections: number };
  redis: { status: string; connected: boolean };
  queues: { status: string };
  providers: { status: string };
  uptime: number;
}

export interface Metrics {
  dau: number;
  wau: number;
  mau: number;
  queueStats: { status: string };
  resourceUsage: { memoryMB: number; uptimeSeconds: number };
}

export interface QueueInfo {
  name: string;
  status: string;
  recentJobs: number;
  failedJobs: number;
}

export interface FailedQueueJob {
  id: string;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  timestamp?: string;
  processedOn?: string;
  finishedOn?: string;
}

export interface SpaceSearchParams {
  query?: string;
  page?: number;
  limit?: number;
}

export interface SpaceInfo {
  id: string;
  name: string;
  type: 'personal' | 'business';
  currency: string;
  createdAt: string;
  members: Array<{ id: string; email: string; name: string; role: string }>;
  accountCount: number;
  budgetCount: number;
}

export interface ProviderHealth {
  name: string;
  status: string;
  accountCount: number;
  lastSyncAt: string | null;
}

export interface DeploymentStatus {
  version: string;
  commitSha: string;
  buildTime: string;
  nodeVersion: string;
  environment: string;
}

export interface GdprExport {
  user: Record<string, unknown>;
  spaces: Array<Record<string, unknown>>;
  transactions: number;
  auditLogs: number;
  exportedAt: string;
}

export interface BillingEvent {
  id: string;
  userId: string;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  severity: string;
  timestamp: string;
  user: { id: string; email: string; name: string } | null;
}

export interface PosCheckoutRequest {
  userId: string;
  plan: string;
  product?: string;
  orgId?: string;
  countryCode?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface PosCheckoutResult {
  checkoutUrl: string;
  provider: string;
  userId: string;
  product: string;
  plan: string;
  countryCode: string | null;
  sessionId: string | null;
}

export interface PosCheckoutStatus {
  sessionId: string;
  provider: string;
  status: string | null;
  paymentStatus: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  paymentIntentId: string | null;
  userId: string | null;
  product: string | null;
  plan: string | null;
  source: string | null;
  amountTotal: number | null;
  currency: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  checkoutUrl: string | null;
  billingEvents: Array<{
    id: string;
    type: string;
    status: string;
    amount: string;
    currency: string;
    createdAt: string;
    metadata: Record<string, unknown> | null;
  }>;
}

export interface WebhookDlqFailure {
  id: string;
  eventId: string;
  consumer: string;
  consumerUrl: string;
  eventType: string | null;
  attemptCount: number;
  lastAttemptAt: string;
  lastStatusCode: number | null;
  lastErrorMessage: string | null;
  nextRetryAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDlqListParams {
  consumer?: string;
  since?: string;
  includeResolved?: boolean;
  limit?: number;
  offset?: number;
}

export interface WebhookDlqListResponse {
  items: WebhookDlqFailure[];
  total: number;
  limit: number;
  offset: number;
}

export interface WebhookDlqReplayResult {
  id: string;
  ok: boolean;
  statusCode: number | null;
  attemptCount: number;
  nextRetryAt: string | null;
  resolvedAt: string | null;
}

export interface WebhookDlqResolveResult {
  id: string;
  resolvedAt: string;
}

// API client
export const adminApi = {
  async searchUsers(params: UserSearchParams = {}): Promise<PaginatedResponse<UserDetails>> {
    const response = await apiClient.get<
      PaginatedResponse<UserDetails> | ApiPaginatedResponse<UserDetails>
    >('/admin/users', params as Record<string, unknown>);
    return normalizePaginated(response);
  },

  async getUserDetails(userId: string): Promise<UserDetails> {
    return apiClient.get<UserDetails>(`/admin/users/${userId}`);
  },

  async getSystemStats(): Promise<SystemStats> {
    return apiClient.get<SystemStats>('/admin/stats');
  },

  async searchAuditLogs(params: AuditLogSearchParams = {}): Promise<PaginatedResponse<AuditLog>> {
    const response = await apiClient.get<
      PaginatedResponse<AuditLog> | ApiPaginatedResponse<AuditLog>
    >('/admin/audit-logs', params as Record<string, unknown>);
    return normalizePaginated(response);
  },

  async getOnboardingFunnel(): Promise<OnboardingFunnel> {
    return apiClient.get<OnboardingFunnel>('/admin/analytics/onboarding-funnel');
  },

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return apiClient.get<FeatureFlag[]>('/admin/feature-flags');
  },

  async getFeatureFlag(key: string): Promise<FeatureFlag> {
    return apiClient.get<FeatureFlag>(`/admin/feature-flags/${key}`);
  },

  async updateFeatureFlag(key: string, updates: Partial<FeatureFlag>): Promise<FeatureFlag> {
    return apiClient.post<FeatureFlag>(`/admin/feature-flags/${key}`, updates);
  },

  // Phase 5 endpoints

  async getSystemHealth(): Promise<SystemHealth> {
    return apiClient.get<SystemHealth>('/admin/health');
  },

  async getMetrics(): Promise<Metrics> {
    return apiClient.get<Metrics>('/admin/metrics');
  },

  async flushCache(pattern: string, confirm: boolean): Promise<{ flushedCount: number }> {
    return apiClient.post<{ flushedCount: number }>('/admin/cache/flush', { pattern, confirm });
  },

  async getQueueStats(): Promise<{ queues: QueueInfo[] }> {
    return apiClient.get<{ queues: QueueInfo[] }>('/admin/queues');
  },

  async retryFailedJobs(queueName: string): Promise<{ retriedCount: number }> {
    return apiClient.post<{ retriedCount: number }>(`/admin/queues/${queueName}/retry-failed`);
  },

  async getFailedJobs(queueName: string, limit = 25): Promise<{ jobs: FailedQueueJob[] }> {
    return apiClient.get<{ jobs: FailedQueueJob[] }>(`/admin/queues/${queueName}/failed`, {
      limit,
    });
  },

  async clearFailedJobs(queueName: string): Promise<{ clearedCount: number }> {
    return apiClient.post<{ clearedCount: number }>(`/admin/queues/${queueName}/clear-failed`, {
      confirm: true,
    });
  },

  async clearQueue(queueName: string): Promise<{ clearedCount: number }> {
    return apiClient.post<{ clearedCount: number }>(`/admin/queues/${queueName}/clear`, {
      confirm: true,
    });
  },

  async searchSpaces(params: SpaceSearchParams = {}): Promise<PaginatedResponse<SpaceInfo>> {
    const response = await apiClient.get<
      PaginatedResponse<SpaceInfo> | ApiPaginatedResponse<SpaceInfo>
    >('/admin/spaces', params as Record<string, unknown>);
    return normalizePaginated(response);
  },

  async deactivateUser(userId: string, reason: string): Promise<{ success: boolean }> {
    return apiClient.patch<{ success: boolean }>(`/admin/users/${userId}/deactivate`, { reason });
  },

  async resetUserTotp(userId: string, reason: string): Promise<{ success: boolean }> {
    return apiClient.patch<{ success: boolean }>(`/admin/users/${userId}/reset-2fa`, { reason });
  },

  async forceLogout(userId: string): Promise<{ invalidatedCount: number }> {
    return apiClient.post<{ invalidatedCount: number }>(`/admin/users/${userId}/force-logout`);
  },

  async getBillingEvents(page?: number, limit?: number): Promise<PaginatedResponse<BillingEvent>> {
    const response = await apiClient.get<
      PaginatedResponse<BillingEvent> | ApiPaginatedResponse<BillingEvent>
    >('/admin/billing/events', {
      page,
      limit,
    } as Record<string, unknown>);
    return normalizePaginated(response);
  },

  async createPosCheckout(body: PosCheckoutRequest): Promise<PosCheckoutResult> {
    return apiClient.post<PosCheckoutResult>('/admin/billing/pos/checkout', body);
  },

  async getPosCheckoutStatus(sessionId: string): Promise<PosCheckoutStatus> {
    return apiClient.post<PosCheckoutStatus>('/admin/billing/pos/status', { sessionId });
  },

  async listWebhookDlqFailures(params: WebhookDlqListParams = {}): Promise<WebhookDlqListResponse> {
    return apiClient.get<WebhookDlqListResponse>('/billing/dlq', params as Record<string, unknown>);
  },

  async replayWebhookDlqFailure(id: string): Promise<WebhookDlqReplayResult> {
    return apiClient.post<WebhookDlqReplayResult>(`/billing/dlq/${id}/replay`);
  },

  async resolveWebhookDlqFailure(id: string, reason?: string): Promise<WebhookDlqResolveResult> {
    return apiClient.post<WebhookDlqResolveResult>(`/billing/dlq/${id}/resolve`, {
      reason: reason?.trim() || undefined,
    });
  },

  async gdprExport(userId: string): Promise<GdprExport> {
    return apiClient.get<GdprExport>(`/admin/gdpr/export/${userId}`);
  },

  async gdprDelete(userId: string): Promise<{ queued: boolean; jobId: string }> {
    return apiClient.post<{ queued: boolean; jobId: string }>(`/admin/gdpr/delete/${userId}`);
  },

  async executeRetention(): Promise<{ executed: boolean; jobId: string }> {
    return apiClient.post<{ executed: boolean; jobId: string }>('/admin/retention/execute');
  },

  async getDeploymentStatus(): Promise<DeploymentStatus> {
    return apiClient.get<DeploymentStatus>('/admin/deployment/status');
  },

  async getProviderHealth(): Promise<{ providers: ProviderHealth[] }> {
    return apiClient.get<{ providers: ProviderHealth[] }>('/admin/providers/health');
  },
};
