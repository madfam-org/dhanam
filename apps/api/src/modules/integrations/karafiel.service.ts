import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

/**
 * Structured transaction metadata extracted from a document.
 * This is what Karafiel cares about for compliance — the fiscal
 * identity of the transaction, not the raw PDF bytes.
 */
export interface ExtractedTransactionData {
  /** ISO 8601 date string of the transaction */
  date: string;
  /** Total amount of the transaction */
  amount: number;
  /** ISO 4217 currency code (e.g. MXN, USD) */
  currency: string;
  /** Merchant / issuer name */
  merchant: string;
  /** RFC / Tax ID of the issuer if present */
  issuerRfc?: string;
  /** RFC / Tax ID of the recipient if present */
  recipientRfc?: string;
  /** Tax amount (IVA etc.) if itemized */
  taxAmount?: number;
  /** Description or concept */
  description?: string;
  /** Raw line items if available */
  lineItems?: Array<{ description: string; quantity?: number; unitPrice?: number; total: number }>;
  /** CFDI UUID if this was a CFDI invoice */
  cfdiUuid?: string;
  /** Confidence score 0-1 from the extraction engine */
  confidence: number;
}

export interface KarafielRegistrationResult {
  /** Karafiel's opaque receipt / folio ID — stored in ComplianceRecord.karafielId */
  karafielId: string;
  /** ISO 8601 timestamp when Karafiel sealed the record */
  sealedAt: string;
  /** Digest used by Karafiel for NOM-151 / hash chain */
  digest: string;
}

@Injectable()
export class KarafielService {
  private readonly logger = new Logger(KarafielService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService
  ) {
    this.baseUrl = this.config.get<string>('KARAFIEL_API_URL') || 'https://api.karafiel.madfam.io';
    this.apiKey = this.config.get<string>('KARAFIEL_API_KEY') || '';
  }

  /**
   * Whether the Karafiel integration is configured.
   * When false, we mock the response in development.
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Compute SHA-256 digest of the raw document buffer for provenance.
   */
  computeDigest(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Register a transaction with Karafiel for compliance sealing.
   *
   * Karafiel cares about the *metadata* of the transaction, not the raw PDF.
   * We also pass the R2 URI so Karafiel can optionally fetch the PDF for
   * NOM-151 hash chain anchoring.
   */
  async registerTransaction(
    transactionData: ExtractedTransactionData,
    documentKey: string,
    documentDigest: string
  ): Promise<KarafielRegistrationResult> {
    const payload = {
      transaction: transactionData,
      provenance: {
        r2Key: documentKey,
        sha256: documentDigest,
      },
      source: 'dhanam',
    };

    if (!this.isConfigured()) {
      this.logger.warn('KARAFIEL_API_KEY not set — returning mock compliance receipt');
      return this.mockReceipt(documentDigest);
    }

    try {
      const response = await firstValueFrom(
        this.http.post<KarafielRegistrationResult>(
          `${this.baseUrl}/v1/compliance/register`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'X-Source': 'dhanam',
            },
            timeout: 15_000,
          }
        )
      );
      this.logger.log(`Karafiel sealed: ${response.data.karafielId}`);
      return response.data;
    } catch (error) {
      this.logger.error('Karafiel registration failed', error);
      // Fail gracefully — log and return a pending/mock receipt so ingestion
      // doesn't block the user. A retry job can attempt re-sealing later.
      return this.mockReceipt(documentDigest, 'PENDING');
    }
  }

  private mockReceipt(
    digest: string,
    prefix = 'MOCK'
  ): KarafielRegistrationResult {
    return {
      karafielId: `${prefix}-${digest.slice(0, 16).toUpperCase()}`,
      sealedAt: new Date().toISOString(),
      digest,
    };
  }
}
