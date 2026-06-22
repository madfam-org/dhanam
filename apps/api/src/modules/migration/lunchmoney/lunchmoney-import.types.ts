export interface LunchMoneyImportCounts {
  categories: number;
  tags: number;
  accounts: number;
  transactionsCreated: number;
  transactionsSkipped: number;
  rulesCreated: number;
  recurringCreated: number;
}

export interface LunchMoneyPreflightResult {
  budgetName: string;
  lunchMoneyAccountId: number;
  primaryCurrency: string;
  dateRange: { startDate: string; endDate: string };
  counts: {
    categories: number;
    tags: number;
    accounts: number;
    plaidAccounts: number;
    manualAssets: number;
    cryptoAccounts: number;
    transactions: number;
    groupTransactionsSkipped: number;
    recurringItems: number;
  };
  limitations: string[];
}

export interface LunchMoneyImportResult {
  budgetName: string;
  lunchMoneyAccountId: number;
  budgetId?: string;
  dryRun: boolean;
  counts: LunchMoneyImportCounts;
  idMapSummary: Record<string, number>;
  spaceTotals?: {
    accounts: number;
    transactions: number;
    categories: number;
    tags: number;
    rules: number;
    recurring: number;
  };
}

export interface LunchMoneyImportRunOptions {
  spaceId: string;
  apiToken: string;
  startDate?: string;
  endDate?: string;
  dryRun?: boolean;
  budgetLabel?: string;
  onLog?: (phase: string, message: string) => void;
}
