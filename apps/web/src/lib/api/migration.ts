import { apiClient } from './client';

export interface MigrationFeatureStatus {
  lunchMoney: boolean;
  csv: boolean;
}

export interface LunchMoneyPreflightCounts {
  categories: number;
  tags: number;
  accounts: number;
  plaidAccounts: number;
  manualAssets: number;
  cryptoAccounts: number;
  transactions: number;
  groupTransactionsSkipped: number;
  recurringItems: number;
}

export interface LunchMoneyPreflightResult {
  budgetName: string;
  lunchMoneyAccountId: number;
  primaryCurrency: string;
  dateRange: { startDate: string; endDate: string };
  counts: LunchMoneyPreflightCounts;
  limitations: string[];
}

export type PlatformImportJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface PlatformImportJob {
  id: string;
  spaceId: string;
  userId: string;
  source: 'lunchmoney' | 'csv';
  status: PlatformImportJobStatus;
  bullmqJobId?: string | null;
  startDate?: string | null;
  preflightSummary?: LunchMoneyPreflightResult | null;
  resultSummary?: Record<string, unknown> | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const migrationApi = {
  getStatus: (spaceId: string) =>
    apiClient.get<MigrationFeatureStatus>(`/spaces/${spaceId}/migration/status`),

  preflightLunchMoney: (spaceId: string, body: { apiToken: string; startDate?: string }) =>
    apiClient.post<LunchMoneyPreflightResult>(
      `/spaces/${spaceId}/migration/lunchmoney/preflight`,
      body
    ),

  startLunchMoneyImport: (
    spaceId: string,
    body: { apiToken: string; startDate?: string; budgetLabel?: string }
  ) => apiClient.post<PlatformImportJob>(`/spaces/${spaceId}/migration/lunchmoney/start`, body),

  getJob: (spaceId: string, jobId: string) =>
    apiClient.get<PlatformImportJob>(`/spaces/${spaceId}/migration/jobs/${jobId}`),

  listJobs: (spaceId: string) =>
    apiClient.get<PlatformImportJob[]>(`/spaces/${spaceId}/migration/jobs`),
};
