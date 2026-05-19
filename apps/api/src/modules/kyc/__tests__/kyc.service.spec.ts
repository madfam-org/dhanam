import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../core/prisma/prisma.service';
import { KycService } from '../kyc.service';
import { MetaMapProvider } from '../metamap.provider';

// KycStatus enum values from Prisma
const KycStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

describe('KycService', () => {
  let service: KycService;
  let prisma: jest.Mocked<PrismaService>;
  let metaMap: jest.Mocked<MetaMapProvider>;

  const mockUserId = 'user-kyc-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        {
          provide: PrismaService,
          useValue: {
            identityVerification: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            verificationDocument: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: MetaMapProvider,
          useValue: {
            createVerificationFlow: jest.fn(),
            getVerificationResult: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    metaMap = module.get(MetaMapProvider) as jest.Mocked<MetaMapProvider>;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // initiateVerification
  // ---------------------------------------------------------------------------
  describe('initiateVerification', () => {
    it('should create a new verification flow when no prior verification exists', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(null);
      metaMap.createVerificationFlow.mockResolvedValue({
        flowId: 'flow-abc',
        verificationUrl: 'https://metamap.com/verify/flow-abc',
      });
      prisma.identityVerification.create.mockResolvedValue({
        id: 'ver-001',
        userId: mockUserId,
        kycStatus: KycStatus.PENDING,
        providerFlowId: 'flow-abc',
        createdAt: new Date(),
      } as any);

      const result = await service.initiateVerification(
        mockUserId,
        'https://app.dhan.am/kyc/callback',
        'MX'
      );

      expect(result).toEqual({
        verificationId: 'ver-001',
        status: KycStatus.PENDING,
        verificationUrl: 'https://metamap.com/verify/flow-abc',
      });
      expect(metaMap.createVerificationFlow).toHaveBeenCalledWith(
        mockUserId,
        'https://app.dhan.am/kyc/callback'
      );
      expect(prisma.identityVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          kycStatus: KycStatus.PENDING,
          providerFlowId: 'flow-abc',
          verificationData: { countryCode: 'MX' },
        }),
      });
    });

    it('should throw ConflictException if user is already VERIFIED', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-001',
        kycStatus: KycStatus.VERIFIED,
      } as any);

      await expect(
        service.initiateVerification(mockUserId, 'https://app.dhan.am/callback')
      ).rejects.toThrow(ConflictException);
    });

    it('should return existing flow info if PENDING verification with providerFlowId exists', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-002',
        kycStatus: KycStatus.PENDING,
        providerFlowId: 'flow-existing',
      } as any);

      const result = await service.initiateVerification(mockUserId, 'https://app.dhan.am/callback');

      expect(result).toEqual({
        verificationId: 'ver-002',
        status: KycStatus.PENDING,
        message: 'Verification already in progress. Continue with the existing flow.',
        verificationUrl: null,
      });
      expect(metaMap.createVerificationFlow).not.toHaveBeenCalled();
    });

    it('should return existing flow info if IN_PROGRESS verification with providerFlowId exists', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-003',
        kycStatus: KycStatus.IN_PROGRESS,
        providerFlowId: 'flow-ip',
      } as any);

      const result = await service.initiateVerification(mockUserId, 'https://app.dhan.am/callback');

      expect(result.verificationId).toBe('ver-003');
      expect(result.verificationUrl).toBeNull();
    });

    it('should create a new flow if PENDING/IN_PROGRESS but no providerFlowId', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-004',
        kycStatus: KycStatus.PENDING,
        providerFlowId: null,
      } as any);
      metaMap.createVerificationFlow.mockResolvedValue({
        flowId: 'flow-new',
        verificationUrl: 'https://metamap.com/verify/flow-new',
      });
      prisma.identityVerification.create.mockResolvedValue({
        id: 'ver-005',
        userId: mockUserId,
        kycStatus: KycStatus.PENDING,
        providerFlowId: 'flow-new',
      } as any);

      const result = await service.initiateVerification(mockUserId, 'https://app.dhan.am/callback');

      expect(result.verificationUrl).toBe('https://metamap.com/verify/flow-new');
      expect(metaMap.createVerificationFlow).toHaveBeenCalled();
    });

    it('should omit verificationData when countryCode is not provided', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(null);
      metaMap.createVerificationFlow.mockResolvedValue({
        flowId: 'flow-xyz',
        verificationUrl: 'https://metamap.com/verify/flow-xyz',
      });
      prisma.identityVerification.create.mockResolvedValue({
        id: 'ver-006',
        userId: mockUserId,
        kycStatus: KycStatus.PENDING,
        providerFlowId: 'flow-xyz',
      } as any);

      await service.initiateVerification(mockUserId, 'https://app.dhan.am/callback');

      expect(prisma.identityVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          verificationData: undefined,
        }),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // processWebhook
  // ---------------------------------------------------------------------------
  describe('processWebhook', () => {
    const baseVerification = {
      id: 'ver-010',
      userId: mockUserId,
      providerFlowId: 'flow-wh',
    };

    it('should silently return when flow is not found', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(null);

      await expect(
        service.processWebhook({ flowId: 'unknown-flow', eventName: 'verification_started' })
      ).resolves.toBeUndefined();

      expect(prisma.identityVerification.update).not.toHaveBeenCalled();
    });

    it('should set status to IN_PROGRESS on verification_started', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_started',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: { kycStatus: KycStatus.IN_PROGRESS },
      });
    });

    it('should set status to IN_PROGRESS on verification_inputs_completed', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_inputs_completed',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: { kycStatus: KycStatus.IN_PROGRESS },
      });
    });

    it('should set status to VERIFIED on successful verification_completed', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);
      metaMap.getVerificationResult.mockResolvedValue({
        flowId: 'flow-wh',
        status: 'verified',
        pepMatch: false,
        sanctionsMatch: false,
        curpValidated: true,
        ineValidated: true,
        details: {},
      });

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_completed',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          kycVerified: true,
          kycVerifiedAt: expect.any(Date),
        },
      });
      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: expect.objectContaining({
          kycStatus: KycStatus.VERIFIED,
          pepMatch: false,
          sanctionsMatch: false,
          curpValidated: true,
          ineValidated: true,
        }),
      });
    });

    it('should set status to REJECTED when PEP match is true', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);
      metaMap.getVerificationResult.mockResolvedValue({
        flowId: 'flow-wh',
        status: 'verified',
        pepMatch: true,
        sanctionsMatch: false,
        curpValidated: true,
        ineValidated: true,
        details: {},
      });

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_completed',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: expect.objectContaining({ kycStatus: KycStatus.REJECTED }),
      });
    });

    it('should set status to REJECTED when sanctions match is true', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);
      metaMap.getVerificationResult.mockResolvedValue({
        flowId: 'flow-wh',
        status: 'verified',
        pepMatch: false,
        sanctionsMatch: true,
        curpValidated: true,
        ineValidated: true,
        details: {},
      });

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_completed',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: expect.objectContaining({ kycStatus: KycStatus.REJECTED }),
      });
    });

    it('should set status to REJECTED when MetaMap status is not "verified"', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);
      metaMap.getVerificationResult.mockResolvedValue({
        flowId: 'flow-wh',
        status: 'reviewNeeded',
        pepMatch: false,
        sanctionsMatch: false,
        curpValidated: true,
        ineValidated: true,
        details: {},
      });

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_completed',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: expect.objectContaining({ kycStatus: KycStatus.REJECTED }),
      });
    });

    it('should handle verification_updated event and re-evaluate status', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);
      metaMap.getVerificationResult.mockResolvedValue({
        flowId: 'flow-wh',
        status: 'verified',
        pepMatch: false,
        sanctionsMatch: false,
        curpValidated: true,
        ineValidated: true,
        details: {},
      });

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_updated',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: expect.objectContaining({ kycStatus: KycStatus.VERIFIED }),
      });
    });

    it('should set status to EXPIRED on verification_expired event', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'verification_expired',
      });

      expect(prisma.identityVerification.update).toHaveBeenCalledWith({
        where: { id: 'ver-010' },
        data: expect.objectContaining({
          kycStatus: KycStatus.EXPIRED,
          completedAt: expect.any(Date),
        }),
      });
    });

    it('should not update on unhandled event types', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(baseVerification as any);

      await service.processWebhook({
        flowId: 'flow-wh',
        eventName: 'some_unknown_event' as any,
      });

      expect(prisma.identityVerification.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------------------
  describe('getStatus', () => {
    it('should return null status when no verification exists', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(null);

      const result = await service.getStatus(mockUserId);

      expect(result).toEqual({
        status: null,
        verified: false,
        message: 'No verification has been initiated for this user.',
      });
    });

    it('should return full verification status with documents', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-020',
        kycStatus: KycStatus.VERIFIED,
        pepMatch: false,
        sanctionsMatch: false,
        curpValidated: true,
        ineValidated: true,
        completedAt: new Date('2026-04-01'),
        createdAt: new Date('2026-03-30'),
        documents: [
          {
            id: 'doc-001',
            documentType: 'ine_front',
            status: 'uploaded',
            createdAt: new Date('2026-03-30'),
          },
        ],
      } as any);

      const result = await service.getStatus(mockUserId);

      expect(result.verified).toBe(true);
      expect(result.status).toBe(KycStatus.VERIFIED);
      expect(result.pepMatch).toBe(false);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].documentType).toBe('ine_front');
    });

    it('should return verified: false for non-VERIFIED statuses', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-021',
        kycStatus: KycStatus.REJECTED,
        pepMatch: true,
        sanctionsMatch: false,
        curpValidated: false,
        ineValidated: false,
        completedAt: new Date(),
        createdAt: new Date(),
        documents: [],
      } as any);

      const result = await service.getStatus(mockUserId);

      expect(result.verified).toBe(false);
      expect(result.status).toBe(KycStatus.REJECTED);
    });
  });

  // ---------------------------------------------------------------------------
  // isVerified
  // ---------------------------------------------------------------------------
  describe('isVerified', () => {
    it('should return true when VERIFIED verification exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ kycVerified: false } as any);
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-030',
        kycStatus: KycStatus.VERIFIED,
      } as any);

      expect(await service.isVerified(mockUserId)).toBe(true);
    });

    it('should return false when no VERIFIED verification exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ kycVerified: false } as any);
      prisma.identityVerification.findFirst.mockResolvedValue(null);

      expect(await service.isVerified(mockUserId)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // uploadDocument
  // ---------------------------------------------------------------------------
  describe('uploadDocument', () => {
    it('should upload a document for an active verification', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-040',
        kycStatus: KycStatus.PENDING,
      } as any);
      prisma.verificationDocument.findFirst.mockResolvedValue(null);
      prisma.verificationDocument.create.mockResolvedValue({
        id: 'doc-010',
        verificationId: 'ver-040',
        documentType: 'ine_front',
        documentUrl: 'https://storage.dhan.am/kyc/docs/ine.jpg',
        status: 'uploaded',
        createdAt: new Date(),
      } as any);

      const result = await service.uploadDocument(mockUserId, {
        documentType: 'ine_front',
        documentUrl: 'https://storage.dhan.am/kyc/docs/ine.jpg',
      });

      expect(result).toEqual(
        expect.objectContaining({
          documentId: 'doc-010',
          documentType: 'ine_front',
          status: 'uploaded',
        })
      );
    });

    it('should throw NotFoundException when no active verification exists', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadDocument(mockUserId, {
          documentType: 'passport',
          documentUrl: 'https://storage.dhan.am/kyc/docs/passport.jpg',
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for duplicate document type', async () => {
      prisma.identityVerification.findFirst.mockResolvedValue({
        id: 'ver-041',
        kycStatus: KycStatus.IN_PROGRESS,
      } as any);
      prisma.verificationDocument.findFirst.mockResolvedValue({
        id: 'doc-existing',
        documentType: 'ine_front',
      } as any);

      await expect(
        service.uploadDocument(mockUserId, {
          documentType: 'ine_front',
          documentUrl: 'https://storage.dhan.am/kyc/docs/ine2.jpg',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
