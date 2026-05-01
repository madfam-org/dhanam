import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { R2StorageService } from '../storage/r2.service';
import { DocumentExtractionService } from './document-extraction.service';
import { KarafielService } from '../integrations/karafiel.service';
import { PrismaService } from '../../core/prisma/prisma.service';

// Retention policy: maps subscription tier → R2 prefix and label
const RETENTION_POLICY_MAP: Record<string, { prefix: string; label: string }> = {
  admin: { prefix: 'retention-20y', label: '20_YEARS' },
  premium: { prefix: 'retention-10y', label: '10_YEARS' },
  pro: { prefix: 'retention-7y', label: '7_YEARS' },
  essentials: { prefix: 'retention-5y', label: '5_YEARS' },
  community: { prefix: 'retention-3y', label: '3_YEARS' },
};

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

interface JwtUser {
  id: string;
  email: string;
  isAdmin?: boolean;
  subscriptionTier?: string;
  spaceId?: string;
}

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compliance')
export class ComplianceIngestController {
  private readonly logger = new Logger(ComplianceIngestController.name);

  constructor(
    private readonly r2: R2StorageService,
    private readonly extractor: DocumentExtractionService,
    private readonly karafiel: KarafielService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * POST /v1/compliance/ingest
   *
   * Accepts a PDF or image representing a financial transaction. The pipeline:
   *   1. Validates file type and size.
   *   2. Determines retention prefix from the user's subscription tier.
   *   3. Uploads the document to R2.
   *   4. Extracts structured transaction metadata (native LLM → Selva fallback).
   *   5. Registers the transaction with Karafiel for compliance sealing.
   *   6. Persists a ComplianceRecord in the database.
   */
  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ingest a financial document for compliance',
    description:
      'Upload a PDF or image of a financial transaction. Dhanam will extract structured metadata, ' +
      'relay it to Karafiel for compliance sealing, and store the original document in R2 under the ' +
      "user's retention tier (up to 20 years for admin tier).",
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF or image of financial document' },
        spaceId: { type: 'string', description: 'Target space ID (optional — defaults to user primary space)' },
        category: { type: 'string', description: 'Document category (invoice, receipt, statement, etc.)' },
      },
      required: ['file'],
    },
  })
  async ingest(@Req() req: FastifyRequest): Promise<{
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
  }> {
    // --- 1. Parse multipart upload ---
    const data = await req.file();
    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const mimeType = data.mimetype;
    const filename = data.filename || 'document';

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type: ${mimeType}. Allowed: PDF, JPEG, PNG, WEBP, GIF`
      );
    }

    // Read the file into memory (max 25MB enforced by @fastify/multipart)
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    this.logger.log(`Ingesting ${filename} (${mimeType}, ${buffer.length} bytes)`);

    // --- 2. Resolve user and retention policy ---
    const user = (req as FastifyRequest & { user: JwtUser }).user;
    const tier = this.resolveUserTier(user);
    const retentionConfig = RETENTION_POLICY_MAP[tier] ?? RETENTION_POLICY_MAP['community'];

    // Resolve spaceId from multipart fields or fallback to user's primary space
    const fields = (data as { fields?: Record<string, { value: string }> }).fields;
    const spaceId = fields?.spaceId?.value || (await this.resolveDefaultSpaceId(user.id));
    const category = fields?.category?.value || 'compliance';

    // --- 3. Upload to R2 under the tier-appropriate retention prefix ---
    if (!this.r2.isAvailable()) {
      throw new BadRequestException('Document storage (R2) is not configured on this instance');
    }

    const uploaded = await this.r2.uploadFile(
      `${spaceId}/${retentionConfig.prefix}`,
      'compliance',
      buffer,
      filename,
      mimeType,
      category
    );

    this.logger.log(`Uploaded to R2: ${uploaded.key}`);

    // --- 4. Extract structured transaction metadata ---
    const { data: transactionData, engine } = await this.extractor.extract(
      buffer,
      mimeType,
      filename
    );
    const extractionState =
      engine === 'native'
        ? 'NATIVE_SUCCESS'
        : transactionData.confidence > 0
          ? 'SELVA_PROCESSED'
          : 'FAILED';

    this.logger.log(`Extraction: engine=${engine}, confidence=${transactionData.confidence}`);

    // --- 5. Compute digest and register with Karafiel ---
    const digest = this.karafiel.computeDigest(buffer);
    const karafielResult = await this.karafiel.registerTransaction(
      transactionData,
      uploaded.key,
      digest
    );

    // --- 6. Persist ComplianceRecord ---
    const record = await this.prisma.complianceRecord.create({
      data: {
        documentKey: uploaded.key,
        spaceId,
        karafielId: karafielResult.karafielId,
        retentionPolicy: retentionConfig.label,
        extractionState,
        sealedAt: karafielResult.sealedAt ? new Date(karafielResult.sealedAt) : null,
      },
    });

    this.logger.log(`ComplianceRecord created: ${record.id} (karafielId=${record.karafielId})`);

    return {
      complianceRecordId: record.id,
      karafielId: karafielResult.karafielId,
      retentionPolicy: retentionConfig.label,
      extractionEngine: engine,
      transactionSummary: {
        date: transactionData.date,
        amount: transactionData.amount,
        currency: transactionData.currency,
        merchant: transactionData.merchant,
        confidence: transactionData.confidence,
      },
    };
  }

  /**
   * Resolve user tier: admins always get the top-tier 20-year retention.
   */
  private resolveUserTier(user: JwtUser): string {
    if (user.isAdmin) return 'admin';
    return user.subscriptionTier || 'community';
  }

  /**
   * Resolve the user's primary/first space as a fallback.
   */
  private async resolveDefaultSpaceId(userId: string): Promise<string> {
    const space = await this.prisma.userSpace.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (!space) {
      throw new BadRequestException('No space found for user — please provide a spaceId');
    }
    return space.spaceId;
  }
}
