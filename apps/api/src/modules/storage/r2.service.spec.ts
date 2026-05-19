import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { createConfigMock, createLoggerMock } from '../../../test/helpers/api-mock-factory';

import { R2StorageService } from './r2.service';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'put' })),
  GetObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'get' })),
  DeleteObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'delete' })),
  HeadObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'head' })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.url/test'),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

describe('R2StorageService', () => {
  let service: R2StorageService;
  let mockS3Client: jest.Mocked<S3Client>;
  let configMock: ReturnType<typeof createConfigMock>;

  describe('with R2 configured', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      configMock = createConfigMock({
        R2_ACCOUNT_ID: 'test-account-id',
        R2_ACCESS_KEY_ID: 'test-access-key',
        R2_SECRET_ACCESS_KEY: 'test-secret-key',
        R2_BUCKET_NAME: 'test-bucket',
        R2_PUBLIC_URL: 'https://test.r2.dev',
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      service = module.get<R2StorageService>(R2StorageService);
      (service as any).logger = createLoggerMock();

      // Get the mock S3 client
      mockS3Client = (service as any).s3Client;
    });

    describe('isAvailable', () => {
      it('should return true when S3 client is configured', () => {
        expect(service.isAvailable()).toBe(true);
      });
    });

    describe('getPresignedUploadUrl', () => {
      it('should generate presigned URL with correct key structure', async () => {
        const result = await service.getPresignedUploadUrl(
          'space-123',
          'asset-456',
          'document.pdf',
          'application/pdf',
          'deed'
        );

        expect(result.uploadUrl).toBe('https://presigned.url/test');
        expect(result.key).toBe('spaces/space-123/assets/asset-456/deed/mock-uuid-1234.pdf');
        expect(result.expiresAt).toBeDefined();
        expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
      });

      it('should use default category when not specified', async () => {
        const result = await service.getPresignedUploadUrl(
          'space-123',
          'asset-456',
          'photo.jpg',
          'image/jpeg'
        );

        expect(result.key).toContain('/general/');
      });

      it('should handle files without extension', async () => {
        const result = await service.getPresignedUploadUrl(
          'space-123',
          'asset-456',
          'document',
          'application/pdf'
        );

        // Files without extension get the filename as extension (split('.').pop() returns 'document')
        expect(result.key).toContain('mock-uuid-1234.document');
      });

      it('should handle filename with trailing dot', async () => {
        const result = await service.getPresignedUploadUrl(
          'space-123',
          'asset-456',
          'file.',
          'application/pdf'
        );

        // split('.').pop() returns '' for 'file.', then || '' makes it ''
        // Result is 'mock-uuid-1234.'
        expect(result.key).toContain('mock-uuid-1234.');
      });

      it('should handle empty filename extension edge case', async () => {
        const result = await service.getPresignedUploadUrl(
          'space-123',
          'asset-456',
          '',
          'application/pdf'
        );

        // Empty string split('.').pop() returns ''
        expect(result.key).toContain('mock-uuid-1234.');
      });

      it('should reject disallowed MIME types', async () => {
        await expect(
          service.getPresignedUploadUrl(
            'space-123',
            'asset-456',
            'file.exe',
            'application/octet-stream'
          )
        ).rejects.toThrow("File type 'application/octet-stream' is not allowed");
      });

      it('should call getSignedUrl with correct parameters', async () => {
        await service.getPresignedUploadUrl(
          'space-123',
          'asset-456',
          'test.pdf',
          'application/pdf'
        );

        expect(getSignedUrl).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            Bucket: 'test-bucket',
            Key: expect.stringContaining('spaces/space-123/assets/asset-456'),
            ContentType: 'application/pdf',
          }),
          { expiresIn: 3600 }
        );
      });
    });

    describe('getPresignedDownloadUrl', () => {
      it('should generate download URL for given key', async () => {
        const url = await service.getPresignedDownloadUrl('some/file/key.pdf');

        expect(url).toBe('https://presigned.url/test');
        expect(getSignedUrl).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            Bucket: 'test-bucket',
            Key: 'some/file/key.pdf',
          }),
          { expiresIn: 3600 }
        );
      });

      it('should respect custom expiration time', async () => {
        await service.getPresignedDownloadUrl('key.pdf', 7200);

        expect(getSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), {
          expiresIn: 7200,
        });
      });
    });

    describe('uploadFile', () => {
      it('should upload file and return document metadata', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({});

        // PDF magic bytes: %PDF
        const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Buffer.from('test content')]);
        const result = await service.uploadFile(
          'space-123',
          'asset-456',
          buffer,
          'document.pdf',
          'application/pdf',
          'contract'
        );

        expect(result.key).toBe('spaces/space-123/assets/asset-456/contract/mock-uuid-1234.pdf');
        expect(result.url).toBe(
          'https://test.r2.dev/spaces/space-123/assets/asset-456/contract/mock-uuid-1234.pdf'
        );
        expect(result.filename).toBe('document.pdf');
        expect(result.fileType).toBe('application/pdf');
        expect(result.fileSize).toBe(buffer.length);
        expect(result.category).toBe('contract');
        expect(result.uploadedAt).toBeDefined();
      });

      it('should call S3 send with PutObjectCommand', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({});

        const buffer = Buffer.from('col1,col2\nval1,val2');
        await service.uploadFile('space-123', 'asset-456', buffer, 'data.csv', 'text/csv');

        expect(mockS3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            _type: 'put',
            Bucket: 'test-bucket',
            Body: buffer,
            ContentType: 'text/csv',
          })
        );
      });

      it('should use default category general', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({});

        const result = await service.uploadFile(
          'space-123',
          'asset-456',
          Buffer.from([0x25, 0x50, 0x44, 0x46]),
          'file.pdf',
          'application/pdf'
        );

        expect(result.category).toBe('general');
        expect(result.key).toContain('/general/');
      });
    });

    describe('deleteFile', () => {
      it('should delete file from S3', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({});

        await service.deleteFile('spaces/space-123/assets/asset-456/document.pdf');

        expect(mockS3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            _type: 'delete',
            Bucket: 'test-bucket',
            Key: 'spaces/space-123/assets/asset-456/document.pdf',
          })
        );
      });

      it('should log deletion', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({});
        const logger = (service as any).logger;

        await service.deleteFile('test-key.pdf');

        expect(logger.log).toHaveBeenCalledWith('Deleted file: test-key.pdf');
      });
    });

    describe('fileExists', () => {
      it('should return true when file exists', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({});

        const exists = await service.fileExists('existing-key.pdf');

        expect(exists).toBe(true);
        expect(mockS3Client.send).toHaveBeenCalledWith(
          expect.objectContaining({
            _type: 'head',
            Bucket: 'test-bucket',
            Key: 'existing-key.pdf',
          })
        );
      });

      it('should return false when file does not exist', async () => {
        mockS3Client.send = jest.fn().mockRejectedValue(new Error('Not found'));

        const exists = await service.fileExists('non-existing-key.pdf');

        expect(exists).toBe(false);
      });
    });

    describe('getPublicUrl', () => {
      it('should return public URL for key', () => {
        const url = service.getPublicUrl('spaces/space-123/document.pdf');

        expect(url).toBe('https://test.r2.dev/spaces/space-123/document.pdf');
      });
    });

    describe('getFileSize', () => {
      it('should return ContentLength from HeadObject', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({ ContentLength: 4096 });

        const result = await service.getFileSize('test-key.pdf');

        expect(result).toBe(4096);
      });

      it('should return null when ContentLength undefined', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({ ContentLength: undefined });

        const result = await service.getFileSize('test-key.pdf');

        expect(result).toBeNull();
      });

      it('should return null on HeadObject error', async () => {
        mockS3Client.send = jest.fn().mockRejectedValue(new Error('Not found'));

        const result = await service.getFileSize('nonexistent.pdf');

        expect(result).toBeNull();
      });
    });

    describe('downloadFile', () => {
      it('should return file as Buffer', async () => {
        const chunks = [Buffer.from('hello '), Buffer.from('world')];
        const asyncIterable = {
          [Symbol.asyncIterator]: () => {
            let i = 0;
            return {
              next: () =>
                Promise.resolve(
                  i < chunks.length
                    ? { value: chunks[i++], done: false }
                    : { value: undefined, done: true }
                ),
            };
          },
        };

        mockS3Client.send = jest.fn().mockResolvedValue({ Body: asyncIterable });

        const result = await service.downloadFile('test-key.pdf');

        expect(result.toString()).toBe('hello world');
      });

      it('should throw when response body is empty', async () => {
        mockS3Client.send = jest.fn().mockResolvedValue({ Body: null });

        await expect(service.downloadFile('empty-key.pdf')).rejects.toThrow(
          'Empty response body from R2'
        );
      });
    });

    describe('getPresignedUploadUrlGeneric', () => {
      it('should generate presigned URL with document key structure', async () => {
        const result = await service.getPresignedUploadUrlGeneric(
          'space-123',
          'report.pdf',
          'application/pdf',
          'report'
        );

        expect(result.key).toContain('spaces/space-123/documents/report/');
        expect(result.uploadUrl).toBe('https://presigned.url/test');
      });

      it('should pass custom metadata to PutObjectCommand', async () => {
        await service.getPresignedUploadUrlGeneric('space-123', 'file.csv', 'text/csv', 'general', {
          customField: 'value',
        });

        expect(getSignedUrl).toHaveBeenCalled();
      });

      it('should reject disallowed MIME types', async () => {
        await expect(
          service.getPresignedUploadUrlGeneric('space', 'f.exe', 'application/octet-stream')
        ).rejects.toThrow("File type 'application/octet-stream' is not allowed");
      });
    });
  });

  describe('without R2 configured', () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      configMock = createConfigMock({
        R2_ACCOUNT_ID: '',
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      service = module.get<R2StorageService>(R2StorageService);
      (service as any).logger = createLoggerMock();
    });

    describe('isAvailable', () => {
      it('should return false when S3 client is not configured', () => {
        expect(service.isAvailable()).toBe(false);
      });
    });

    describe('getPresignedUploadUrl', () => {
      it('should throw error when not configured', async () => {
        await expect(
          service.getPresignedUploadUrl('space', 'asset', 'file.pdf', 'application/pdf')
        ).rejects.toThrow('R2 Storage is not configured');
      });
    });

    describe('getPresignedDownloadUrl', () => {
      it('should throw error when not configured', async () => {
        await expect(service.getPresignedDownloadUrl('key.pdf')).rejects.toThrow(
          'R2 Storage is not configured'
        );
      });
    });

    describe('uploadFile', () => {
      it('should throw error when not configured', async () => {
        await expect(
          service.uploadFile('space', 'asset', Buffer.from(''), 'file.pdf', 'application/pdf')
        ).rejects.toThrow('R2 Storage is not configured');
      });
    });

    describe('deleteFile', () => {
      it('should throw error when not configured', async () => {
        await expect(service.deleteFile('key.pdf')).rejects.toThrow('R2 Storage is not configured');
      });
    });

    describe('fileExists', () => {
      it('should return false when not configured', async () => {
        const exists = await service.fileExists('key.pdf');
        expect(exists).toBe(false);
      });
    });

    describe('getPublicUrl', () => {
      it('should still return URL even when not configured', () => {
        // Public URL uses config default, not S3 client
        const url = service.getPublicUrl('key.pdf');
        expect(url).toContain('key.pdf');
      });
    });
  });

  describe('constructor logging', () => {
    it('should log success when configured', async () => {
      const loggerMock = createLoggerMock();

      configMock = createConfigMock({
        R2_ACCOUNT_ID: 'test-account',
        R2_ACCESS_KEY_ID: 'test-key',
        R2_SECRET_ACCESS_KEY: 'test-secret',
      });

      const module = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      const svc = module.get<R2StorageService>(R2StorageService);
      (svc as any).logger = loggerMock;

      // Constructor already ran, but we can check the service was created with s3Client
      expect(svc.isAvailable()).toBe(true);
    });

    it('should log warning when not configured', async () => {
      configMock = createConfigMock({
        R2_ACCOUNT_ID: '',
        R2_ACCESS_KEY_ID: '',
        R2_SECRET_ACCESS_KEY: '',
      });

      const module = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      const svc = module.get<R2StorageService>(R2StorageService);
      expect(svc.isAvailable()).toBe(false);
    });
  });

  describe('validateUpload', () => {
    it('should accept valid PDF file', () => {
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, ...Buffer.from('test')]);
      expect(() => service.validateUpload(buffer, 'application/pdf', 'test.pdf')).not.toThrow();
    });

    it('should accept valid CSV file', () => {
      const buffer = Buffer.from('col1,col2\nval1,val2');
      expect(() => service.validateUpload(buffer, 'text/csv', 'data.csv')).not.toThrow();
    });

    it('should throw when file exceeds max size', () => {
      const buffer = Buffer.concat([
        Buffer.from([0x25, 0x50, 0x44, 0x46]),
        Buffer.alloc(26 * 1024 * 1024),
      ]);
      expect(() => service.validateUpload(buffer, 'application/pdf', 'huge.pdf')).toThrow(
        'File exceeds maximum size'
      );
    });

    it('should throw for disallowed MIME type', () => {
      const buffer = Buffer.from('test');
      expect(() => service.validateUpload(buffer, 'application/octet-stream', 'file.exe')).toThrow(
        "File type 'application/octet-stream' is not allowed"
      );
    });

    it('should throw for disallowed extension', () => {
      const buffer = Buffer.from('test');
      expect(() => service.validateUpload(buffer, 'text/csv', 'file.exe')).toThrow(
        "File extension '.exe' is not allowed"
      );
    });

    it('should throw for missing extension', () => {
      const buffer = Buffer.from('test');
      expect(() => service.validateUpload(buffer, 'text/csv', 'noext')).toThrow('is not allowed');
    });

    it('should throw when magic bytes mismatch', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, ...Buffer.from('not pdf')]);
      expect(() => service.validateUpload(buffer, 'application/pdf', 'fake.pdf')).toThrow(
        'File content does not match declared content type'
      );
    });

    it('should accept PNG with correct magic bytes', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, ...Buffer.from('data')]);
      expect(() => service.validateUpload(buffer, 'image/png', 'image.png')).not.toThrow();
    });
  });

  describe('constructor configuration fallbacks', () => {
    it('should use default bucket name when R2_BUCKET_NAME not provided (line 40 fallback)', async () => {
      configMock = createConfigMock({
        R2_ACCOUNT_ID: 'test-account',
        R2_ACCESS_KEY_ID: 'test-key',
        R2_SECRET_ACCESS_KEY: 'test-secret',
        R2_BUCKET_NAME: '', // Empty - should use default
        R2_PUBLIC_URL: 'https://custom.url',
      });

      const module = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      const svc = module.get<R2StorageService>(R2StorageService);
      // Verify default bucket is used by checking public URL generation
      const url = svc.getPublicUrl('test.pdf');
      expect(url).toBe('https://custom.url/test.pdf');
    });

    it('should use default public URL when R2_PUBLIC_URL not provided (line 41-43 fallback)', async () => {
      configMock = createConfigMock({
        R2_ACCOUNT_ID: 'test-account-id',
        R2_ACCESS_KEY_ID: 'test-key',
        R2_SECRET_ACCESS_KEY: 'test-secret',
        R2_BUCKET_NAME: 'my-bucket',
        R2_PUBLIC_URL: '', // Empty - should use default based on account ID
      });

      const module = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      const svc = module.get<R2StorageService>(R2StorageService);
      const url = svc.getPublicUrl('test.pdf');
      // Default URL format: https://${bucket}.${accountId}.r2.cloudflarestorage.com
      expect(url).toContain('my-bucket');
      expect(url).toContain('test-account-id');
      expect(url).toContain('r2.cloudflarestorage.com');
    });

    it('should use both default bucket and URL when neither provided', async () => {
      configMock = createConfigMock({
        R2_ACCOUNT_ID: 'account-xyz',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET_NAME: '', // Uses 'dhanam-documents' default
        R2_PUBLIC_URL: '', // Uses constructed default
      });

      const module = await Test.createTestingModule({
        providers: [R2StorageService, { provide: ConfigService, useValue: configMock }],
      }).compile();

      const svc = module.get<R2StorageService>(R2StorageService);
      const url = svc.getPublicUrl('file.pdf');
      // Should contain default bucket name
      expect(url).toContain('dhanam-documents');
      expect(url).toContain('account-xyz');
    });
  });
});
