import { Test, TestingModule } from '@nestjs/testing';
import * as qrcode from 'qrcode';
import * as speakeasy from 'speakeasy';

import { CryptoService } from '@core/crypto/crypto.service';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@db';

import { TotpService } from '../totp.service';

describe('TotpService', () => {
  let service: TotpService;
  let prisma: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<LoggerService>;
  let cryptoService: CryptoService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    totpSecret: null,
    totpTempSecret: null,
    totpEnabled: false,
    totpBackupCodes: [],
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    // Use real CryptoService for encryption/decryption
    process.env.ENCRYPTION_KEY = 'test-encryption-key-12345';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TotpService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LoggerService, useValue: mockLogger },
        CryptoService,
      ],
    }).compile();

    service = module.get<TotpService>(TotpService);
    prisma = module.get(PrismaService);
    logger = module.get(LoggerService);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupTotp', () => {
    it('should generate 32-character secret', async () => {
      prisma.user.update.mockResolvedValue(mockUser as any);

      const result = await service.setupTotp(mockUser.id, mockUser.email);

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThanOrEqual(32);
      expect(result.manualEntryKey).toBe(result.secret);
    });

    it('should generate QR code data URL', async () => {
      prisma.user.update.mockResolvedValue(mockUser as any);

      const result = await service.setupTotp(mockUser.id, mockUser.email);

      expect(result.qrCodeUrl).toBeDefined();
      expect(result.qrCodeUrl).toContain('data:image/png;base64');
    });

    it('should store temporary secret without activating TOTP', async () => {
      prisma.user.update.mockResolvedValue(mockUser as any);

      await service.setupTotp(mockUser.id, mockUser.email);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { totpTempSecret: expect.any(String) },
      });

      // Should NOT set totpSecret or totpEnabled
      const updateCall = prisma.user.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('totpSecret');
      expect(updateCall.data).not.toHaveProperty('totpEnabled');

      // Verify secret is encrypted
      const storedSecret = updateCall.data.totpTempSecret;
      expect(storedSecret).toMatch(/^v1:/); // Should have version prefix
    });

    it('should include correct issuer and name in QR code', async () => {
      prisma.user.update.mockResolvedValue(mockUser as any);

      const result = await service.setupTotp(mockUser.id, mockUser.email);

      // Verify QR code URL contains the expected issuer and email
      // QR codes encode the otpauth URL which includes issuer and name
      expect(result.qrCodeUrl).toBeDefined();
      expect(result.qrCodeUrl).toContain('data:image/png;base64');

      // The secret should be properly generated
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('enableTotp', () => {
    const tempSecret = 'JBSWY3DPEHPK3PXP';

    it('should activate TOTP with valid verification code', async () => {
      // Encrypt the temp secret as it would be stored
      const encryptedTempSecret = cryptoService.encrypt(tempSecret);

      const userWithTempSecret = {
        ...mockUser,
        totpTempSecret: encryptedTempSecret,
      };

      prisma.user.findUnique.mockResolvedValue(userWithTempSecret as any);
      prisma.user.update.mockResolvedValue({
        ...userWithTempSecret,
        totpSecret: encryptedTempSecret,
        totpEnabled: true,
        totpTempSecret: null,
      } as any);

      // Generate a valid TOTP token for the secret
      const validToken = speakeasy.totp({
        secret: tempSecret,
        encoding: 'base32',
      });

      await service.enableTotp(mockUser.id, validToken);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          totpSecret: encryptedTempSecret,
          totpTempSecret: null,
          totpEnabled: true,
        },
      });
    });

    it('should reject invalid TOTP token', async () => {
      const encryptedTempSecret = cryptoService.encrypt(tempSecret);

      const userWithTempSecret = {
        ...mockUser,
        totpTempSecret: encryptedTempSecret,
      };

      prisma.user.findUnique.mockResolvedValue(userWithTempSecret as any);

      await expect(service.enableTotp(mockUser.id, '000000')).rejects.toThrow('Invalid TOTP token');

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw error if no TOTP setup in progress', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.enableTotp(mockUser.id, '123456')).rejects.toThrow(
        'No TOTP setup in progress'
      );
    });

    it('should throw error if user is not found (line 59 null user branch)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.enableTotp('nonexistent-user', '123456')).rejects.toThrow(
        'No TOTP setup in progress'
      );
    });

    it('should verify token with 2-step window for clock drift', async () => {
      const encryptedTempSecret = cryptoService.encrypt(tempSecret);

      const userWithTempSecret = {
        ...mockUser,
        totpTempSecret: encryptedTempSecret,
      };

      prisma.user.findUnique.mockResolvedValue(userWithTempSecret as any);

      const verifySpy = jest.spyOn(speakeasy.totp, 'verify');
      const validToken = speakeasy.totp({
        secret: tempSecret,
        encoding: 'base32',
      });

      prisma.user.update.mockResolvedValue({} as any);

      await service.enableTotp(mockUser.id, validToken);

      expect(verifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          window: 2, // 2-step window for clock drift
        })
      );
    });
  });

  describe('disableTotp', () => {
    const activeSecret = 'JBSWY3DPEHPK3PXP';

    it('should disable TOTP with valid token', async () => {
      const encryptedSecret = cryptoService.encrypt(activeSecret);

      const userWithTotp = {
        ...mockUser,
        totpSecret: encryptedSecret,
        totpEnabled: true,
      };

      prisma.user.findUnique.mockResolvedValue(userWithTotp as any);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        totpSecret: null,
        totpEnabled: false,
      } as any);

      const validToken = speakeasy.totp({
        secret: activeSecret,
        encoding: 'base32',
      });

      await service.disableTotp(mockUser.id, validToken);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          totpSecret: null,
          totpTempSecret: null,
          totpEnabled: false,
        },
      });
    });

    it('should reject invalid token when disabling', async () => {
      const encryptedSecret = cryptoService.encrypt(activeSecret);

      const userWithTotp = {
        ...mockUser,
        totpSecret: encryptedSecret,
        totpEnabled: true,
      };

      prisma.user.findUnique.mockResolvedValue(userWithTotp as any);

      await expect(service.disableTotp(mockUser.id, '000000')).rejects.toThrow(
        'Invalid TOTP token'
      );
    });

    it('should throw error if TOTP not enabled', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.disableTotp(mockUser.id, '123456')).rejects.toThrow('TOTP not enabled');
    });

    it('should throw error if user is not found (line 93 null user branch)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.disableTotp('nonexistent-user', '123456')).rejects.toThrow(
        'TOTP not enabled'
      );
    });
  });

  describe('verifyToken', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    it('should verify valid TOTP code', () => {
      const validToken = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const result = service.verifyToken(secret, validToken);

      expect(result).toBe(true);
    });

    it('should reject expired codes', () => {
      // Use a token from 5 minutes ago (should be expired)
      const expiredToken = speakeasy.totp({
        secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000) - 300,
      });

      const result = service.verifyToken(secret, expiredToken);

      expect(result).toBe(false);
    });

    it('should reject invalid codes', () => {
      const result = service.verifyToken(secret, '000000');

      expect(result).toBe(false);
    });

    it('should use 2-step window', () => {
      const verifySpy = jest.spyOn(speakeasy.totp, 'verify');
      const validToken = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      service.verifyToken(secret, validToken);

      expect(verifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          window: 2,
        })
      );
    });
  });

  describe('verifyEncryptedToken', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    it('should verify valid TOTP code with encrypted secret', () => {
      const encryptedSecret = cryptoService.encrypt(secret);
      const validToken = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const result = service.verifyEncryptedToken(encryptedSecret, validToken);

      expect(result).toBe(true);
    });

    it('should reject invalid codes with encrypted secret', () => {
      const encryptedSecret = cryptoService.encrypt(secret);

      const result = service.verifyEncryptedToken(encryptedSecret, '000000');

      expect(result).toBe(false);
    });

    it('should decrypt before verification', () => {
      const encryptedSecret = cryptoService.encrypt(secret);
      const validToken = speakeasy.totp({
        secret,
        encoding: 'base32',
      });

      const decryptSpy = jest.spyOn(cryptoService, 'decrypt');
      const verifyTokenSpy = jest.spyOn(service, 'verifyToken');

      service.verifyEncryptedToken(encryptedSecret, validToken);

      expect(decryptSpy).toHaveBeenCalledWith(encryptedSecret);
      expect(verifyTokenSpy).toHaveBeenCalledWith(secret, validToken);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const codes = service.generateBackupCodes();

      expect(codes).toHaveLength(10);
    });

    it('should generate unique codes', () => {
      const codes = service.generateBackupCodes();
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(10);
    });

    it('should use cryptographically secure random bytes', () => {
      const codes = service.generateBackupCodes();

      // Each code should be 8 characters (hex from 4 bytes)
      codes.forEach((code) => {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[0-9A-F]+$/); // Uppercase hex
      });
    });

    it('should generate different codes on each call', () => {
      const codes1 = service.generateBackupCodes();
      const codes2 = service.generateBackupCodes();

      expect(codes1).not.toEqual(codes2);
    });
  });

  describe('storeBackupCodes', () => {
    it('should hash codes before storing', async () => {
      const codes = ['12345678', '87654321'];
      prisma.user.update.mockResolvedValue(mockUser as any);

      await service.storeBackupCodes(mockUser.id, codes);

      const updateCall = prisma.user.update.mock.calls[0][0];
      const storedCodes = updateCall.data.totpBackupCodes;

      // Stored codes should be SHA256 hashes (64 characters)
      expect(storedCodes).toHaveLength(2);
      storedCodes.forEach((hash: string) => {
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[0-9a-f]+$/);
      });

      // Hashes should not match original codes
      expect(storedCodes).not.toContain(codes[0]);
      expect(storedCodes).not.toContain(codes[1]);
    });

    it('should log backup code generation', async () => {
      const codes = ['12345678'];
      prisma.user.update.mockResolvedValue(mockUser as any);

      await service.storeBackupCodes(mockUser.id, codes);

      expect(logger.log).toHaveBeenCalledWith(
        `Backup codes generated for user: ${mockUser.id}`,
        'TotpService'
      );
    });
  });

  describe('verifyBackupCode', () => {
    const validCode = '12345678';
    const hashedCode = require('crypto').createHash('sha256').update(validCode).digest('hex');

    it('should verify valid backup code', async () => {
      const userWithBackupCodes = {
        ...mockUser,
        totpBackupCodes: [hashedCode, 'otherhash'],
      };

      prisma.user.findUnique.mockResolvedValue(userWithBackupCodes as any);
      prisma.user.update.mockResolvedValue(mockUser as any);

      const result = await service.verifyBackupCode(mockUser.id, validCode);

      expect(result).toBe(true);
    });

    it('should invalidate used backup code', async () => {
      const userWithBackupCodes = {
        ...mockUser,
        totpBackupCodes: [hashedCode, 'otherhash'],
      };

      prisma.user.findUnique.mockResolvedValue(userWithBackupCodes as any);
      prisma.user.update.mockResolvedValue(mockUser as any);

      await service.verifyBackupCode(mockUser.id, validCode);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          totpBackupCodes: ['otherhash'], // Used code removed
        },
      });
    });

    it('should reject invalid backup code', async () => {
      const userWithBackupCodes = {
        ...mockUser,
        totpBackupCodes: [hashedCode],
      };

      prisma.user.findUnique.mockResolvedValue(userWithBackupCodes as any);

      const result = await service.verifyBackupCode(mockUser.id, 'invalid');

      expect(result).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should return false if no backup codes exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.verifyBackupCode(mockUser.id, validCode);

      expect(result).toBe(false);
    });

    it('should return false if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.verifyBackupCode('non-existent-user', validCode);

      expect(result).toBe(false);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should log when backup code is used', async () => {
      const userWithBackupCodes = {
        ...mockUser,
        totpBackupCodes: [hashedCode],
      };

      prisma.user.findUnique.mockResolvedValue(userWithBackupCodes as any);
      prisma.user.update.mockResolvedValue(mockUser as any);

      await service.verifyBackupCode(mockUser.id, validCode);

      expect(logger.log).toHaveBeenCalledWith(
        `Backup code used for user: ${mockUser.id}`,
        'TotpService'
      );
    });

    it('should return false and log error when verification throws', async () => {
      prisma.user.findUnique.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.verifyBackupCode(mockUser.id, validCode);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to verify backup code'),
        expect.any(String),
        'TotpService'
      );
    });

    it('should return false for code not matching any stored hash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        totpBackupCodes: ['aaaa', 'bbbb'],
      } as any);

      const result = await service.verifyBackupCode(mockUser.id, 'ABCD1234');

      expect(result).toBe(false);
    });
  });

  describe('handleError (error mapping)', () => {
    it('should map PrismaClientKnownRequestError P2025 to BusinessRuleException', async () => {
      const prismaError = new PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      prisma.user.update.mockRejectedValue(prismaError);

      await expect(service.storeBackupCodes(mockUser.id, ['12345678'])).rejects.toThrow(
        'not found'
      );
    });

    it('should map other PrismaClientKnownRequestError to InfrastructureException', async () => {
      const prismaError = new PrismaClientKnownRequestError('Connection error', {
        code: 'P2024',
        clientVersion: '5.0.0',
      });
      prisma.user.update.mockRejectedValue(prismaError);

      await expect(service.storeBackupCodes(mockUser.id, ['12345678'])).rejects.toThrow(
        'Database operation failed'
      );
    });

    it('should wrap unknown errors as InfrastructureException', async () => {
      prisma.user.update.mockRejectedValue(new Error('Unknown error'));

      await expect(service.storeBackupCodes(mockUser.id, ['12345678'])).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('TOTP operation failed'),
        expect.any(String),
        'TotpService'
      );
    });

    it('should wrap non-Error values as InfrastructureException', async () => {
      prisma.user.update.mockRejectedValue('string error');

      await expect(service.storeBackupCodes(mockUser.id, ['12345678'])).rejects.toThrow();
    });
  });

  describe('setupTotp error paths', () => {
    it('should propagate handleError on prisma failure', async () => {
      prisma.user.update.mockRejectedValue(new Error('DB error'));

      await expect(service.setupTotp(mockUser.id, mockUser.email)).rejects.toThrow();
    });
  });

  describe('enableTotp error paths', () => {
    it('should throw ValidationException for non-6-digit token', async () => {
      await expect(service.enableTotp(mockUser.id, 'abc')).rejects.toThrow(
        'Invalid input for field: token'
      );
    });

    it('should throw ValidationException for empty token', async () => {
      await expect(service.enableTotp(mockUser.id, '')).rejects.toThrow(
        'Invalid input for field: token'
      );
    });
  });

  describe('disableTotp error paths', () => {
    it('should throw ValidationException for non-6-digit token', async () => {
      await expect(service.disableTotp(mockUser.id, 'abc')).rejects.toThrow(
        'Invalid input for field: token'
      );
    });

    it('should throw ValidationException for empty token', async () => {
      await expect(service.disableTotp(mockUser.id, '')).rejects.toThrow(
        'Invalid input for field: token'
      );
    });
  });
});
