import { apiClient } from './client';

export type CapitalPurpose =
  | 'personal_life'
  | 'owner_facility'
  | 'entity_operating'
  | 'equity_stake';

export interface CapitalStackAccount {
  id: string;
  name: string;
  type: string;
  capitalPurpose: CapitalPurpose | null;
  spaceId: string;
  space: {
    id: string;
    name: string;
    type: string;
  };
}
export type OwnerCapitalJournalStatus =
  | 'draft'
  | 'proposed'
  | 'matched'
  | 'compliance_pending'
  | 'compliance_sealed'
  | 'manual_review'
  | 'void';

export type OwnerCapitalFlowType =
  | 'capital_contribution'
  | 'shareholder_loan'
  | 'loan_repayment'
  | 'owner_draw'
  | 'distribution';

export interface CapitalStackSpace {
  id: string;
  name: string;
  type: string;
}

export interface CapitalStackEntityGroup {
  id: string;
  name: string;
  type: string;
  baseCurrency: string;
  beneficialOwnerUserId?: string | null;
  spaces: CapitalStackSpace[];
  beneficialOwner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface CapitalStackDashboard {
  entityGroup: CapitalStackEntityGroup;
  metrics: {
    journalByStatus: Record<string, number>;
    unreconciledFlows: number;
    ownerFacilityAccountCount: number;
  };
}

export interface OwnerCapitalJournalEntry {
  id: string;
  entityGroupId: string;
  flowType: OwnerCapitalFlowType;
  status: OwnerCapitalJournalStatus;
  amount: number;
  currency: string;
  notes?: string | null;
  sourceTransactionId?: string | null;
  targetTransactionId?: string | null;
  karafielCaseId?: string | null;
  detectionConfidence?: number | null;
  createdAt: string;
  updatedAt: string;
}

export const capitalStackApi = {
  listGroups(): Promise<CapitalStackEntityGroup[]> {
    return apiClient.get<CapitalStackEntityGroup[]>('/capital-stack/groups');
  },

  getDashboard(entityGroupId: string): Promise<CapitalStackDashboard> {
    return apiClient.get<CapitalStackDashboard>(`/capital-stack/groups/${entityGroupId}/dashboard`);
  },

  listJournal(params?: {
    entityGroupId?: string;
    status?: OwnerCapitalJournalStatus;
    flowType?: OwnerCapitalFlowType;
  }): Promise<OwnerCapitalJournalEntry[]> {
    const search = new URLSearchParams();
    if (params?.entityGroupId) search.set('entityGroupId', params.entityGroupId);
    if (params?.status) search.set('status', params.status);
    if (params?.flowType) search.set('flowType', params.flowType);
    const qs = search.toString();
    return apiClient.get<OwnerCapitalJournalEntry[]>(`/capital-stack/journal${qs ? `?${qs}` : ''}`);
  },

  listAccounts(entityGroupId: string): Promise<CapitalStackAccount[]> {
    return apiClient.get<CapitalStackAccount[]>(`/capital-stack/groups/${entityGroupId}/accounts`);
  },

  bulkCapitalPurpose(
    entityGroupId: string,
    updates: Array<{ accountId: string; capitalPurpose: CapitalPurpose }>
  ): Promise<{ updated: number; accounts: CapitalStackAccount[] }> {
    return apiClient.post('/capital-stack/accounts/bulk-capital-purpose', {
      entityGroupId,
      updates,
    });
  },

  matchJournal(
    journalId: string,
    targetTransactionId: string,
    targetSpaceId?: string
  ): Promise<OwnerCapitalJournalEntry> {
    return apiClient.post<OwnerCapitalJournalEntry>(`/capital-stack/journal/${journalId}/match`, {
      targetTransactionId,
      targetSpaceId,
    });
  },

  sendToKarafiel(journalId: string): Promise<{
    karafiel_case_id: string;
    status: string;
    review_required: boolean;
  }> {
    return apiClient.post(`/capital-stack/journal/${journalId}/send-to-karafiel`);
  },
};
