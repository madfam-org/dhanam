import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { KycStatus, Prisma } from '@db';

import { PrismaService } from '../../core/prisma/prisma.service';

import { UploadDocumentDto } from './dto';
import { MetaMapWebhookPayloadDto } from './dto/webhook-payload.dto';
import { MetaMapProvider } from './metamap.provider';

/**
 * =============================================================================
 * KYC / AML Service
 * =============================================================================
 * Orchestrates identity verification workflows for CNBV regulatory compliance.
 *
 * Responsibilities:
 * - Create and manage IdentityVerification records
 * - Coordinate with MetaMap provider for verification flows
 * - Process webhook callbacks from MetaMap
 * - Check user verification status for guard integration
 * =============================================================================
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private prisma: PrismaService,
    private metaMap: MetaMapProvider
  ) {}

  /**
   * Initiate a new identity verification flow for a user.
   *
   * If the user already has a VERIFIED verification, this throws a conflict.
   * If there is a PENDING or IN_PROGRESS verification, it returns the existing flow URL
   * rather than creating a duplicate.
   *
   * @param userId      The authenticated user's ID
   * @param redirectUrl Where MetaMap should redirect after the flow completes
   * @returns           The MetaMap verification URL and verification record ID
   */
  async initiateVerification(userId: string, redirectUrl: string, countryCode?: string) {
    // Check for existing verification
    const existing = await this.prisma.identityVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.kycStatus === KycStatus.VERIFIED) {
      throw new ConflictException('User identity has already been verified');
    }

    if (
      existing &&
      (existing.kycStatus === KycStatus.PENDING || existing.kycStatus === KycStatus.IN_PROGRESS)
    ) {
      this.logger.log(
        `User ${userId} already has ${existing.kycStatus} verification ${existing.id}`
      );
      // If we still have a flow ID, try to give them the URL again
      // Otherwise create a new flow
      if (existing.providerFlowId) {
        return {
          verificationId: existing.id,
          status: existing.kycStatus,
          message: 'Verification already in progress. Continue with the existing flow.',
          verificationUrl: null, // MetaMap does not allow re-fetching the URL; user must use original link
        };
      }
    }

    // Create the MetaMap verification flow
    const flow = await this.metaMap.createVerificationFlow(userId, redirectUrl);

    // Create or update IdentityVerification record
    const verification = await this.prisma.identityVerification.create({
      data: {
        userId,
        kycStatus: KycStatus.PENDING,
        providerFlowId: flow.flowId,
        verificationData: countryCode ? { countryCode } : undefined,
      },
    });

    this.logger.log(
      `Verification ${verification.id} created for user ${userId} with flow ${flow.flowId}`
    );

    return {
      verificationId: verification.id,
      status: verification.kycStatus,
      verificationUrl: flow.verificationUrl,
    };
  }

  /**
   * Process an incoming MetaMap webhook event.
   *
   * Maps MetaMap event types to KycStatus transitions and persists
   * verification results (PEP, sanctions, CURP, INE).
   */
  async processWebhook(payload: MetaMapWebhookPayloadDto): Promise<void> {
    const { flowId, eventName } = payload;

    const verification = await this.prisma.identityVerification.findFirst({
      where: { providerFlowId: flowId },
    });

    if (!verification) {
      this.logger.warn(`Webhook received for unknown flow: ${flowId}`);
      return;
    }

    this.logger.log(
      `Processing webhook event "${eventName}" for verification ${verification.id} (flow ${flowId})`
    );

    switch (eventName) {
      case 'verification_started':
        await this.prisma.identityVerification.update({
          where: { id: verification.id },
          data: { kycStatus: KycStatus.IN_PROGRESS },
        });
        break;

      case 'verification_inputs_completed':
        // User submitted their inputs; still awaiting review/processing
        await this.prisma.identityVerification.update({
          where: { id: verification.id },
          data: { kycStatus: KycStatus.IN_PROGRESS },
        });
        break;

      case 'verification_completed': {
        // Fetch full results from MetaMap for authoritative data
        const result = await this.metaMap.getVerificationResult(flowId);

        const isVerified =
          result.status === 'verified' && !result.pepMatch && !result.sanctionsMatch;

        await this.prisma.identityVerification.update({
          where: { id: verification.id },
          data: {
            kycStatus: isVerified ? KycStatus.VERIFIED : KycStatus.REJECTED,
            pepMatch: result.pepMatch,
            sanctionsMatch: result.sanctionsMatch,
            curpValidated: result.curpValidated,
            ineValidated: result.ineValidated,
            verificationData: result.details as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        if (!isVerified) {
          this.logger.warn(
            `Verification ${verification.id} REJECTED for user ${verification.userId}: ` +
              `PEP=${result.pepMatch}, sanctions=${result.sanctionsMatch}, status=${result.status}`
          );
        } else {
          // Enable live payment methods for this user
          await this.prisma.user.update({
            where: { id: verification.userId },
            data: {
              kycVerified: true,
              kycVerifiedAt: new Date(),
            },
          });

          this.logger.log(
            `Verification ${verification.id} VERIFIED for user ${verification.userId} — payment methods unlocked`
          );
        }
        break;
      }

      case 'verification_updated': {
        // Re-fetch results (e.g., manual review updated the status)
        const updatedResult = await this.metaMap.getVerificationResult(flowId);

        const isNowVerified =
          updatedResult.status === 'verified' &&
          !updatedResult.pepMatch &&
          !updatedResult.sanctionsMatch;

        await this.prisma.identityVerification.update({
          where: { id: verification.id },
          data: {
            kycStatus: isNowVerified ? KycStatus.VERIFIED : KycStatus.REJECTED,
            pepMatch: updatedResult.pepMatch,
            sanctionsMatch: updatedResult.sanctionsMatch,
            curpValidated: updatedResult.curpValidated,
            ineValidated: updatedResult.ineValidated,
            verificationData: updatedResult.details as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
        break;
      }

      case 'verification_expired':
        await this.prisma.identityVerification.update({
          where: { id: verification.id },
          data: {
            kycStatus: KycStatus.EXPIRED,
            completedAt: new Date(),
          },
        });
        this.logger.log(`Verification ${verification.id} EXPIRED for user ${verification.userId}`);
        break;

      default:
        this.logger.warn(`Unhandled MetaMap event: ${eventName}`);
    }
  }

  /**
   * Get the current KYC status for a user, including the most recent
   * verification details.
   */
  async getStatus(userId: string) {
    const verification = await this.prisma.identityVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { documents: true },
    });

    if (!verification) {
      return {
        status: null,
        verified: false,
        message: 'No verification has been initiated for this user.',
      };
    }

    return {
      verificationId: verification.id,
      status: verification.kycStatus,
      verified: verification.kycStatus === KycStatus.VERIFIED,
      pepMatch: verification.pepMatch,
      sanctionsMatch: verification.sanctionsMatch,
      curpValidated: verification.curpValidated,
      ineValidated: verification.ineValidated,
      documents: verification.documents.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        status: doc.status,
        createdAt: doc.createdAt,
      })),
      completedAt: verification.completedAt,
      createdAt: verification.createdAt,
    };
  }

  /**
   * Check whether a user has a VERIFIED identity verification.
   * Used by the KycVerifiedGuard.
   */
  async isVerified(userId: string): Promise<boolean> {
    // Fast path: check denormalized flag on User
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kycVerified: true },
    });

    if (user?.kycVerified) {
      return true;
    }

    // Fallback: check IdentityVerification table (covers pre-migration data)
    const verification = await this.prisma.identityVerification.findFirst({
      where: {
        userId,
        kycStatus: KycStatus.VERIFIED,
      },
    });

    return verification !== null;
  }

  /**
   * Upload a verification document and attach it to the user's active verification.
   */
  async uploadDocument(userId: string, dto: UploadDocumentDto) {
    const verification = await this.prisma.identityVerification.findFirst({
      where: {
        userId,
        kycStatus: { in: [KycStatus.PENDING, KycStatus.IN_PROGRESS] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new NotFoundException('No active verification found. Start a verification flow first.');
    }

    // Check for duplicate document type
    const existingDoc = await this.prisma.verificationDocument.findFirst({
      where: {
        verificationId: verification.id,
        documentType: dto.documentType,
      },
    });

    if (existingDoc) {
      throw new BadRequestException(
        `A ${dto.documentType} document has already been uploaded for this verification. ` +
          'Start a new verification flow to re-submit documents.'
      );
    }

    const document = await this.prisma.verificationDocument.create({
      data: {
        verificationId: verification.id,
        documentType: dto.documentType,
        documentUrl: dto.documentUrl,
        status: 'uploaded',
      },
    });

    this.logger.log(
      `Document ${document.id} (${dto.documentType}) uploaded for verification ${verification.id}`
    );

    return {
      documentId: document.id,
      documentType: document.documentType,
      status: document.status,
      createdAt: document.createdAt,
    };
  }
}
