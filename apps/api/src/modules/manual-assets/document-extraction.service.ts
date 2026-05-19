import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { firstValueFrom } from 'rxjs';

import type { ExtractedTransactionData } from '../integrations/karafiel.service';

const NATIVE_EXTRACTION_SYSTEM_PROMPT = `You are a financial document parser for Dhanam, MADFAM's financial platform.
Your task is to extract structured transaction metadata from receipts, invoices, and bank statements.

Return a JSON object with these fields (omit fields you cannot confidently extract):
{
  "date": "ISO 8601 date (YYYY-MM-DD)",
  "amount": number (total amount),
  "currency": "ISO 4217 code (MXN, USD, EUR, etc.)",
  "merchant": "Merchant or issuer name",
  "issuerRfc": "RFC of the issuer (if Mexican CFDI)",
  "recipientRfc": "RFC of the recipient (if Mexican CFDI)",
  "taxAmount": number (IVA or tax amount if itemized),
  "description": "Short description or concept",
  "lineItems": [{ "description": string, "quantity": number, "unitPrice": number, "total": number }],
  "cfdiUuid": "UUID of CFDI folio fiscal if present",
  "documentType": "receipt | invoice | bank_statement | account_statement | other",
  "statementPeriodStart": "YYYY-MM-DD if this is a statement",
  "statementPeriodEnd": "YYYY-MM-DD if this is a statement",
  "accountLast4": "last four account digits if visible",
  "openingBalance": number,
  "closingBalance": number,
  "transactions": [{ "date": "YYYY-MM-DD", "description": string, "amount": number, "balance": number, "currency": "MXN" }],
  "confidence": number between 0.0 and 1.0
}

For bank statements, prefer preserving the statement-level summary and transaction rows over forcing the whole document into a single merchant transaction.
Be strict: if you cannot read the document or the document is not a financial transaction, set confidence below 0.4.`;

const CONFIDENCE_THRESHOLD = 0.5;

export interface ExtractionResult {
  data: ExtractedTransactionData;
  /** Which engine successfully extracted the data */
  engine: 'native' | 'selva';
}

@Injectable()
export class DocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);
  private readonly openai: OpenAI | null;
  private readonly selvaBaseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    // Selva is the MADFAM inference router — OpenAI-compatible /v1 endpoint
    this.selvaBaseUrl = this.config.get<string>('SELVA_API_URL') || 'https://selva.madfam.io/v1';
  }

  /**
   * Extract structured transaction data from a document buffer.
   *
   * Strategy:
   *   1. Try native extraction via OpenAI vision (GPT-4o-mini).
   *   2. If native confidence < 0.5 or native fails → forward to Selva for
   *      in-depth agentic consideration.
   */
  async extract(buffer: Buffer, mimeType: string, filename: string): Promise<ExtractionResult> {
    this.logger.log(`Extracting from ${filename} (${mimeType}, ${buffer.length} bytes)`);

    // Native extraction attempt
    if (this.openai) {
      try {
        const nativeResult = await this.extractNative(buffer, mimeType, filename);
        if (nativeResult.confidence >= CONFIDENCE_THRESHOLD) {
          this.logger.log(`Native extraction succeeded (confidence=${nativeResult.confidence})`);
          return { data: nativeResult, engine: 'native' };
        }
        this.logger.warn(
          `Native confidence too low (${nativeResult.confidence}) — escalating to Selva`
        );
      } catch (err) {
        this.logger.warn(
          `Native extraction failed: ${(err as Error).message} — escalating to Selva`
        );
      }
    } else {
      this.logger.warn('OPENAI_API_KEY not set — escalating directly to Selva');
    }

    // Selva fallback
    const selvaResult = await this.extractViaSelva(buffer, mimeType, filename);
    return { data: selvaResult, engine: 'selva' };
  }

  /**
   * Native extraction: encode the document as base64 and send to GPT-4o-mini
   * vision endpoint for structured JSON extraction.
   */
  private async extractNative(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<ExtractedTransactionData> {
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const textPreview = mimeType === 'text/csv' ? buffer.toString('utf-8').slice(0, 60_000) : '';

    // For PDFs, send the filename as context since OpenAI vision doesn't
    // natively render multi-page PDFs — we rely on the first-page rendering
    // if the client converts it, or use text for single-page PDFs.
    const isImage = mimeType.startsWith('image/');
    const documentContext = textPreview
      ? `Filename: ${filename}. CSV/text statement content:\n${textPreview}`
      : `Filename: ${filename}. This is a ${mimeType} document. Extract all financial transaction metadata you can from the available document context, and set confidence appropriately if you cannot read the content.`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: NATIVE_EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: isImage
          ? [
              {
                type: 'image_url' as const,
                image_url: { url: dataUrl, detail: 'high' as const },
              },
              {
                type: 'text' as const,
                text: `Filename: ${filename}. Extract all financial transaction metadata from this document.`,
              },
            ]
          : documentContext,
      },
    ];

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as Partial<ExtractedTransactionData>;

    return {
      date: parsed.date || new Date().toISOString().slice(0, 10),
      amount: parsed.amount ?? 0,
      currency: parsed.currency || 'MXN',
      merchant: parsed.merchant || 'Unknown',
      issuerRfc: parsed.issuerRfc,
      recipientRfc: parsed.recipientRfc,
      taxAmount: parsed.taxAmount,
      description: parsed.description,
      lineItems: parsed.lineItems,
      cfdiUuid: parsed.cfdiUuid,
      documentType: parsed.documentType,
      statementPeriodStart: parsed.statementPeriodStart,
      statementPeriodEnd: parsed.statementPeriodEnd,
      accountLast4: parsed.accountLast4,
      openingBalance: parsed.openingBalance,
      closingBalance: parsed.closingBalance,
      transactions: parsed.transactions,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.3,
    };
  }

  /**
   * Selva fallback: send the document to the Selva agentic inference router
   * for in-depth consideration. Selva returns the same structured shape.
   *
   * Selva is OpenAI-compatible so we POST to /v1/chat/completions with the
   * Dhanam-specific agent routing header.
   */
  private async extractViaSelva(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<ExtractedTransactionData> {
    this.logger.log('Sending document to Selva for agentic extraction');

    const selvaKey = this.config.get<string>('SELVA_API_KEY') || '';
    const base64 = buffer.toString('base64');
    const isImage = mimeType.startsWith('image/');
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const textPreview = mimeType === 'text/csv' ? buffer.toString('utf-8').slice(0, 60_000) : '';
    const encodedPreview = base64.slice(0, 16_000);

    const body = {
      model: 'auto', // Selva picks the best model
      messages: [
        { role: 'system', content: NATIVE_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: isImage
            ? [
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
                {
                  type: 'text',
                  text: `Filename: ${filename}. This is a complex financial document that requires deep analysis. Extract all transaction metadata.`,
                },
              ]
            : textPreview
              ? `Filename: ${filename}. Deep-analyze this CSV/text financial statement and extract all transaction metadata:\n${textPreview}`
              : `Filename: ${filename}. Deep-analyze this ${mimeType} financial document. Base64 prefix (${encodedPreview.length}/${base64.length} chars): ${encodedPreview}. Extract all transaction metadata and set confidence accurately.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
      temperature: 0,
    };

    try {
      const resp = await firstValueFrom(
        this.http.post<{ choices: Array<{ message: { content: string } }> }>(
          `${this.selvaBaseUrl}/chat/completions`,
          body,
          {
            headers: {
              Authorization: selvaKey ? `Bearer ${selvaKey}` : '',
              'X-Agent': 'dhanam-document-extractor',
              'Content-Type': 'application/json',
            },
            timeout: 60_000,
          }
        )
      );
      const content = resp.data.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content) as Partial<ExtractedTransactionData>;
      return {
        date: parsed.date || new Date().toISOString().slice(0, 10),
        amount: parsed.amount ?? 0,
        currency: parsed.currency || 'MXN',
        merchant: parsed.merchant || 'Unknown',
        issuerRfc: parsed.issuerRfc,
        recipientRfc: parsed.recipientRfc,
        taxAmount: parsed.taxAmount,
        description: parsed.description,
        lineItems: parsed.lineItems,
        cfdiUuid: parsed.cfdiUuid,
        documentType: parsed.documentType,
        statementPeriodStart: parsed.statementPeriodStart,
        statementPeriodEnd: parsed.statementPeriodEnd,
        accountLast4: parsed.accountLast4,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        transactions: parsed.transactions,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.6,
      };
    } catch (err) {
      this.logger.error('Selva extraction also failed — returning stub', err);
      // Return a minimal stub so the upload is not lost; compliance record
      // will be marked as FAILED for later manual review.
      return {
        date: new Date().toISOString().slice(0, 10),
        amount: 0,
        currency: 'MXN',
        merchant: filename,
        description: 'Automatic extraction failed — manual review required',
        confidence: 0,
      };
    }
  }
}
