import { LocalMfaProvider } from '../providers/local-mfa.provider';
import { TotpService, TotpSetupResponse } from '../totp.service';

describe('LocalMfaProvider', () => {
  let provider: LocalMfaProvider;
  let totpService: jest.Mocked<TotpService>;

  const mockSetupResponse: TotpSetupResponse = {
    qrCodeUrl: 'data:image/png;base64,abc123',
    secret: 'JBSWY3DPEHPK3PXP',
    manualEntryKey: 'JBSWY3DPEHPK3PXP',
  };

  beforeEach(() => {
    totpService = {
      setupTotp: jest.fn().mockResolvedValue(mockSetupResponse),
      enableTotp: jest.fn().mockResolvedValue(undefined),
      disableTotp: jest.fn().mockResolvedValue(undefined),
      verifyToken: jest.fn().mockReturnValue(true),
      verifyEncryptedToken: jest.fn().mockReturnValue(true),
      generateBackupCodes: jest.fn().mockReturnValue(['ABCD1234', 'EFGH5678']),
      storeBackupCodes: jest.fn().mockResolvedValue(undefined),
      verifyBackupCode: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<TotpService>;

    provider = new LocalMfaProvider(totpService);
  });

  describe('setupTotp', () => {
    it('should delegate to TotpService.setupTotp', async () => {
      const result = await provider.setupTotp('user-123', 'test@example.com');

      expect(totpService.setupTotp).toHaveBeenCalledWith('user-123', 'test@example.com');
      expect(result).toEqual(mockSetupResponse);
    });
  });

  describe('enableTotp', () => {
    it('should delegate to TotpService.enableTotp', async () => {
      await provider.enableTotp('user-123', '123456');

      expect(totpService.enableTotp).toHaveBeenCalledWith('user-123', '123456');
    });
  });

  describe('disableTotp', () => {
    it('should delegate to TotpService.disableTotp', async () => {
      await provider.disableTotp('user-123', '654321');

      expect(totpService.disableTotp).toHaveBeenCalledWith('user-123', '654321');
    });
  });

  describe('verifyToken', () => {
    it('should delegate to TotpService.verifyToken', () => {
      const result = provider.verifyToken('secret-key', '123456');

      expect(totpService.verifyToken).toHaveBeenCalledWith('secret-key', '123456');
      expect(result).toBe(true);
    });
  });

  describe('verifyEncryptedToken', () => {
    it('should delegate to TotpService.verifyEncryptedToken', () => {
      const result = provider.verifyEncryptedToken('encrypted-secret', '123456');

      expect(totpService.verifyEncryptedToken).toHaveBeenCalledWith('encrypted-secret', '123456');
      expect(result).toBe(true);
    });
  });

  describe('generateBackupCodes', () => {
    it('should delegate to TotpService.generateBackupCodes', () => {
      const result = provider.generateBackupCodes();

      expect(totpService.generateBackupCodes).toHaveBeenCalled();
      expect(result).toEqual(['ABCD1234', 'EFGH5678']);
    });
  });

  describe('storeBackupCodes', () => {
    it('should delegate to TotpService.storeBackupCodes', async () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      await provider.storeBackupCodes('user-123', codes);

      expect(totpService.storeBackupCodes).toHaveBeenCalledWith('user-123', codes);
    });
  });

  describe('verifyBackupCode', () => {
    it('should delegate to TotpService.verifyBackupCode', async () => {
      const result = await provider.verifyBackupCode('user-123', 'ABCD1234');

      expect(totpService.verifyBackupCode).toHaveBeenCalledWith('user-123', 'ABCD1234');
      expect(result).toBe(true);
    });
  });

  describe('interface compliance', () => {
    it('should implement all MfaProvider methods', () => {
      expect(typeof provider.setupTotp).toBe('function');
      expect(typeof provider.enableTotp).toBe('function');
      expect(typeof provider.disableTotp).toBe('function');
      expect(typeof provider.verifyToken).toBe('function');
      expect(typeof provider.verifyEncryptedToken).toBe('function');
      expect(typeof provider.generateBackupCodes).toBe('function');
      expect(typeof provider.storeBackupCodes).toBe('function');
      expect(typeof provider.verifyBackupCode).toBe('function');
    });
  });
});
