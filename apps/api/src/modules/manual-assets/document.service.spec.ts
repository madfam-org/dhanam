import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { createPrismaMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';
import { PrismaService } from '../../core/prisma/prisma.service';
import { SpacesService } from '../spaces/spaces.service';
import { R2StorageService } from '../storage/r2.service';

import { DocumentService } from './document.service';

describe('DocumentService', () => {
  let service: DocumentService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let spacesServiceMock: jest.Mocked<Partial<SpacesService>>;
  let r2StorageMock: jest.Mocked<Partial<R2StorageService>>;

  const testSpaceId = 'space-123';
  const testUserId = 'user-456';
  const testAssetId = 'asset-789';

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = createPrismaMock();
    spacesServiceMock = {
      verifyUserAccess: jest.fn().mockResolvedValue(undefined),
    };
    r2StorageMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      getPresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://presigned.url/upload',
        key: 'spaces/space-123/assets/asset-789/general/uuid.pdf',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      }),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://presigned.url/download'),
      fileExists: jest.fn().mockResolvedValue(true),
      getPublicUrl: jest.fn().mockImplementation((key) => `https://public.url/${key}`),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SpacesService, useValue: spacesServiceMock },
        { provide: R2StorageService, useValue: r2StorageMock },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);
  });

  describe('isStorageAvailable', () => {
    it('should return true when R2 storage is available', () => {
      expect(service.isStorageAvailable()).toBe(true);
      expect(r2StorageMock.isAvailable).toHaveBeenCalled();
    });

    it('should return false when R2 storage is not available', () => {
      r2StorageMock.isAvailable!.mockReturnValue(false);
      expect(service.isStorageAvailable()).toBe(false);
    });
  });

  describe('getUploadUrl', () => {
    const mockAsset = {
      id: testAssetId,
      spaceId: testSpaceId,
      name: 'Test Asset',
    };

    beforeEach(() => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);
    });

    it('should return presigned URL for valid request', async () => {
      const result = await service.getUploadUrl(
        testSpaceId,
        testUserId,
        testAssetId,
        'document.pdf',
        'application/pdf',
        'deed'
      );

      expect(result.uploadUrl).toBe('https://presigned.url/upload');
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
      expect(r2StorageMock.getPresignedUploadUrl).toHaveBeenCalledWith(
        testSpaceId,
        testAssetId,
        'document.pdf',
        'application/pdf',
        'deed'
      );
    });

    it('should use default category when not specified', async () => {
      await service.getUploadUrl(testSpaceId, testUserId, testAssetId, 'photo.jpg', 'image/jpeg');

      expect(r2StorageMock.getPresignedUploadUrl).toHaveBeenCalledWith(
        testSpaceId,
        testAssetId,
        'photo.jpg',
        'image/jpeg',
        'general'
      );
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.getUploadUrl(testSpaceId, testUserId, testAssetId, 'doc.pdf', 'application/pdf')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid file type', async () => {
      await expect(
        service.getUploadUrl(
          testSpaceId,
          testUserId,
          testAssetId,
          'malware.exe',
          'application/x-msdownload'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid category', async () => {
      await expect(
        service.getUploadUrl(
          testSpaceId,
          testUserId,
          testAssetId,
          'doc.pdf',
          'application/pdf',
          'invalid-category'
        )
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept all allowed file types', async () => {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
      ];

      for (const contentType of allowedTypes) {
        await expect(
          service.getUploadUrl(testSpaceId, testUserId, testAssetId, 'file', contentType)
        ).resolves.toBeDefined();
      }
    });

    it('should accept all valid categories', async () => {
      const categories = [
        'deed',
        'title',
        'appraisal',
        'insurance',
        'contract',
        'receipt',
        'statement',
        'certificate',
        'photo',
        'general',
      ];

      for (const category of categories) {
        await expect(
          service.getUploadUrl(
            testSpaceId,
            testUserId,
            testAssetId,
            'doc.pdf',
            'application/pdf',
            category
          )
        ).resolves.toBeDefined();
      }
    });
  });

  describe('confirmUpload', () => {
    const mockAsset = {
      id: testAssetId,
      spaceId: testSpaceId,
      name: 'Test Asset',
      documents: [],
    };

    const confirmDto = {
      key: 'spaces/space-123/assets/asset-789/general/uuid.pdf',
      filename: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      category: 'deed',
    };

    beforeEach(() => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);
      prismaMock.manualAsset.update.mockResolvedValue({ ...mockAsset, documents: [{}] });
    });

    it('should confirm upload and return document metadata', async () => {
      const result = await service.confirmUpload(testSpaceId, testUserId, testAssetId, confirmDto);

      expect(result.key).toBe(confirmDto.key);
      expect(result.filename).toBe(confirmDto.filename);
      expect(result.fileType).toBe(confirmDto.fileType);
      expect(result.fileSize).toBe(confirmDto.fileSize);
      expect(result.category).toBe('deed');
      expect(result.uploadedAt).toBeDefined();
      expect(r2StorageMock.fileExists).toHaveBeenCalledWith(confirmDto.key);
    });

    it('should use default category when not provided', async () => {
      const dtoWithoutCategory = { ...confirmDto, category: undefined };

      const result = await service.confirmUpload(
        testSpaceId,
        testUserId,
        testAssetId,
        dtoWithoutCategory
      );

      expect(result.category).toBe('general');
    });

    it('should append to existing documents', async () => {
      const existingDoc = { key: 'existing.pdf', filename: 'existing.pdf' };
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: [existingDoc],
      });

      await service.confirmUpload(testSpaceId, testUserId, testAssetId, confirmDto);

      expect(prismaMock.manualAsset.update).toHaveBeenCalledWith({
        where: { id: testAssetId },
        data: {
          documents: expect.arrayContaining([
            existingDoc,
            expect.objectContaining({ key: confirmDto.key }),
          ]),
        },
      });
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmUpload(testSpaceId, testUserId, testAssetId, confirmDto)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when file size exceeds limit', async () => {
      const largeSizeDto = { ...confirmDto, fileSize: 51 * 1024 * 1024 }; // 51MB

      await expect(
        service.confirmUpload(testSpaceId, testUserId, testAssetId, largeSizeDto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file was not uploaded', async () => {
      r2StorageMock.fileExists!.mockResolvedValue(false);

      await expect(
        service.confirmUpload(testSpaceId, testUserId, testAssetId, confirmDto)
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept file size at exactly the limit', async () => {
      const maxSizeDto = { ...confirmDto, fileSize: 50 * 1024 * 1024 }; // 50MB exactly

      await expect(
        service.confirmUpload(testSpaceId, testUserId, testAssetId, maxSizeDto)
      ).resolves.toBeDefined();
    });

    it('should handle null documents array (line 151 branch)', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: null,
      });

      const result = await service.confirmUpload(testSpaceId, testUserId, testAssetId, confirmDto);

      expect(result.key).toBe(confirmDto.key);
      expect(prismaMock.manualAsset.update).toHaveBeenCalledWith({
        where: { id: testAssetId },
        data: {
          documents: expect.arrayContaining([expect.objectContaining({ key: confirmDto.key })]),
        },
      });
    });
  });

  describe('getDocuments', () => {
    const mockDocuments = [
      { key: 'doc1.pdf', filename: 'Document 1.pdf', category: 'deed' },
      { key: 'doc2.jpg', filename: 'Photo.jpg', category: 'photo' },
    ];

    const mockAsset = {
      id: testAssetId,
      spaceId: testSpaceId,
      documents: mockDocuments,
    };

    it('should return all documents for an asset', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);

      const result = await service.getDocuments(testSpaceId, testUserId, testAssetId);

      expect(result).toEqual(mockDocuments);
      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'viewer'
      );
    });

    it('should return empty array when asset has no documents', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: null,
      });

      const result = await service.getDocuments(testSpaceId, testUserId, testAssetId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(null);

      await expect(service.getDocuments(testSpaceId, testUserId, testAssetId)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getDownloadUrl', () => {
    const documentKey = 'spaces/space-123/assets/asset-789/deed/doc.pdf';
    const mockDocuments = [{ key: documentKey, filename: 'doc.pdf' }];
    const mockAsset = {
      id: testAssetId,
      spaceId: testSpaceId,
      documents: mockDocuments,
    };

    it('should return presigned download URL', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);

      const result = await service.getDownloadUrl(
        testSpaceId,
        testUserId,
        testAssetId,
        documentKey
      );

      expect(result).toBe('https://presigned.url/download');
      expect(r2StorageMock.getPresignedDownloadUrl).toHaveBeenCalledWith(documentKey);
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.getDownloadUrl(testSpaceId, testUserId, testAssetId, documentKey)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when document does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: [],
      });

      await expect(
        service.getDownloadUrl(testSpaceId, testUserId, testAssetId, documentKey)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when document key does not match', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);

      await expect(
        service.getDownloadUrl(testSpaceId, testUserId, testAssetId, 'wrong-key.pdf')
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle null documents array (line 203 branch)', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: null,
      });

      await expect(
        service.getDownloadUrl(testSpaceId, testUserId, testAssetId, documentKey)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteDocument', () => {
    const documentKey = 'spaces/space-123/assets/asset-789/deed/doc.pdf';
    const mockDocuments = [
      { key: documentKey, filename: 'doc.pdf' },
      { key: 'other.pdf', filename: 'other.pdf' },
    ];
    const mockAsset = {
      id: testAssetId,
      spaceId: testSpaceId,
      documents: mockDocuments,
    };

    it('should delete document from R2 and update asset', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);
      prismaMock.manualAsset.update.mockResolvedValue({});

      await service.deleteDocument(testSpaceId, testUserId, testAssetId, documentKey);

      expect(r2StorageMock.deleteFile).toHaveBeenCalledWith(documentKey);
      expect(prismaMock.manualAsset.update).toHaveBeenCalledWith({
        where: { id: testAssetId },
        data: {
          documents: [{ key: 'other.pdf', filename: 'other.pdf' }],
        },
      });
    });

    it('should verify member access', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);

      await service.deleteDocument(testSpaceId, testUserId, testAssetId, documentKey);

      expect(spacesServiceMock.verifyUserAccess).toHaveBeenCalledWith(
        testUserId,
        testSpaceId,
        'member'
      );
    });

    it('should throw NotFoundException when asset does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteDocument(testSpaceId, testUserId, testAssetId, documentKey)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when document does not exist', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: [],
      });

      await expect(
        service.deleteDocument(testSpaceId, testUserId, testAssetId, documentKey)
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove only the specified document', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue(mockAsset);

      await service.deleteDocument(testSpaceId, testUserId, testAssetId, documentKey);

      const updateCall = prismaMock.manualAsset.update.mock.calls[0][0];
      expect(updateCall.data.documents).toHaveLength(1);
      expect(updateCall.data.documents[0].key).toBe('other.pdf');
    });

    it('should handle null documents array (line 233 branch)', async () => {
      prismaMock.manualAsset.findFirst.mockResolvedValue({
        ...mockAsset,
        documents: null,
      });

      await expect(
        service.deleteDocument(testSpaceId, testUserId, testAssetId, documentKey)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllowedFileTypes', () => {
    it('should return list of allowed MIME types', () => {
      const types = service.getAllowedFileTypes();

      expect(types).toContain('application/pdf');
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
      expect(types).toContain('text/csv');
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('getDocumentCategories', () => {
    it('should return list of valid categories', () => {
      const categories = service.getDocumentCategories();

      expect(categories).toContain('deed');
      expect(categories).toContain('title');
      expect(categories).toContain('insurance');
      expect(categories).toContain('general');
      expect(categories.length).toBeGreaterThan(0);
    });
  });
});
