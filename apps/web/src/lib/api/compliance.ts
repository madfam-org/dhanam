import { authStore } from '../../stores/auth';

export interface ComplianceIngestResult {
  complianceRecordId: string;
  karafielId: string;
  retentionPolicy: string;
  extractionEngine: string;
  transactionSummary: {
    date: string;
    amount: number;
    currency: string;
    merchant: string;
    confidence: number;
  };
  statementSummary?: {
    periodStart?: string;
    periodEnd?: string;
    accountLast4?: string;
    openingBalance?: number;
    closingBalance?: number;
    transactionCount: number;
  };
}

export const complianceApi = {
  ingestStatement: async (
    spaceId: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<ComplianceIngestResult> => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dhan.am/v1';
    const formData = new FormData();
    formData.append('spaceId', spaceId);
    formData.append('category', 'statement');
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${baseUrl}/compliance/ingest`);
      const token = authStore.getState().accessToken;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const payload = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(payload as ComplianceIngestResult);
            return;
          }
          reject(new Error(payload.message || payload.error || `Upload failed with ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading statement'));
      xhr.send(formData);
    });
  },
};
