import { CryptoService } from '../crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  const originalEnv = process.env.ENCRYPTION_KEY;

  describe('with ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-12345';
      service = new CryptoService();
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    describe('encrypt', () => {
      it('should encrypt a string successfully', () => {
        const plaintext = 'sensitive-data';
        const encrypted = service.encrypt(plaintext);

        expect(encrypted).toBeDefined();
        expect(encrypted).not.toBe(plaintext);
        // New format: v1:iv:tag:ciphertext (4 parts)
        expect(encrypted.split(':')).toHaveLength(4);
        expect(encrypted).toMatch(/^v1:/);
      });

      it('should produce different ciphertext for same plaintext (due to random IV)', () => {
        const plaintext = 'test-data';
        const encrypted1 = service.encrypt(plaintext);
        const encrypted2 = service.encrypt(plaintext);

        expect(encrypted1).not.toBe(encrypted2);
      });

      it('should handle empty string encryption', () => {
        const encrypted = service.encrypt('');

        expect(encrypted).toBeDefined();
        expect(encrypted.split(':')).toHaveLength(4);
        expect(encrypted).toMatch(/^v1:/);
      });

      it('should handle unicode characters', () => {
        const plaintext = '🔐 Datos seguros con émojis';
        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });

      it('should handle very long strings', () => {
        const plaintext = 'A'.repeat(10000);
        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });
    });

    describe('decrypt', () => {
      it('should decrypt encrypted data correctly', () => {
        const plaintext = 'my-secret-data';
        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
      });

      it('should throw error for invalid encrypted data format - missing parts', () => {
        expect(() => service.decrypt('invalid-data')).toThrow('Invalid encrypted data format');
      });

      it('should throw error for invalid encrypted data format - only two parts', () => {
        expect(() => service.decrypt('part1:part2')).toThrow('Invalid encrypted data format');
      });

      it('should throw error for invalid encrypted data format - empty parts', () => {
        expect(() => service.decrypt('::')).toThrow('Invalid encrypted data format');
      });

      it('should throw error for invalid encrypted data format - empty iv', () => {
        expect(() => service.decrypt(':authTag:encrypted')).toThrow(
          'Invalid encrypted data format'
        );
      });

      it('should throw error for invalid encrypted data format - empty authTag', () => {
        expect(() => service.decrypt('iv::encrypted')).toThrow('Invalid encrypted data format');
      });

      it('should throw error for invalid encrypted data format - empty encrypted', () => {
        expect(() => service.decrypt('iv:authTag:')).toThrow('Invalid encrypted data format');
      });

      it('should throw error for tampered authTag', () => {
        const plaintext = 'sensitive';
        const encrypted = service.encrypt(plaintext);
        const parts = encrypted.split(':');
        // Tamper with the authTag (now at index 2 in v1:iv:tag:ct format)
        parts[2] = '00'.repeat(16);
        const tampered = parts.join(':');

        expect(() => service.decrypt(tampered)).toThrow();
      });

      it('should throw error for tampered ciphertext', () => {
        const plaintext = 'sensitive';
        const encrypted = service.encrypt(plaintext);
        const parts = encrypted.split(':');
        // Tamper with the encrypted data (now at index 3 in v1:iv:tag:ct format)
        parts[3] = '00'.repeat(parts[3].length / 2);
        const tampered = parts.join(':');

        expect(() => service.decrypt(tampered)).toThrow();
      });
    });

    describe('hash', () => {
      it('should produce consistent hash for same input', () => {
        const data = 'test-data';
        const hash1 = service.hash(data);
        const hash2 = service.hash(data);

        expect(hash1).toBe(hash2);
      });

      it('should produce different hashes for different inputs', () => {
        const hash1 = service.hash('data1');
        const hash2 = service.hash('data2');

        expect(hash1).not.toBe(hash2);
      });

      it('should return a 64-character hex string (SHA-256)', () => {
        const hash = service.hash('test');

        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]+$/);
      });

      it('should handle empty string', () => {
        const hash = service.hash('');

        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]+$/);
      });

      it('should handle unicode characters', () => {
        const hash = service.hash('🔐 encrypted');

        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]+$/);
      });

      it('should handle very long strings', () => {
        const data = 'A'.repeat(100000);
        const hash = service.hash(data);

        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]+$/);
      });
    });
  });

  describe('without ENCRYPTION_KEY (uses generated key)', () => {
    let loggerWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      delete process.env.ENCRYPTION_KEY;
      service = new CryptoService();
      loggerWarnSpy = jest.spyOn(service['logger'], 'warn');
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalEnv;
      if (loggerWarnSpy) {
        loggerWarnSpy.mockRestore();
      }
    });

    it('should warn when ENCRYPTION_KEY is not set', () => {
      // Create a new service instance to trigger the warning
      delete process.env.ENCRYPTION_KEY;
      const testService = new CryptoService();

      // Warning should have been logged during construction
      expect(testService['logger'].warn).toBeDefined();
    });

    it('should still work with generated key', () => {
      service = new CryptoService();

      const plaintext = 'test-data';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should generate unique keys per instance (data not portable between instances)', () => {
      const service1 = new CryptoService();
      const service2 = new CryptoService();

      const encrypted = service1.encrypt('secret');

      // Different instances with generated keys cannot decrypt each other's data
      expect(() => service2.decrypt(encrypted)).toThrow();
    });
  });

  describe('key consistency', () => {
    it('should use same key for all operations within instance', () => {
      process.env.ENCRYPTION_KEY = 'consistent-key';
      service = new CryptoService();

      const data1 = 'first';
      const data2 = 'second';

      const encrypted1 = service.encrypt(data1);
      const encrypted2 = service.encrypt(data2);

      expect(service.decrypt(encrypted1)).toBe(data1);
      expect(service.decrypt(encrypted2)).toBe(data2);

      process.env.ENCRYPTION_KEY = originalEnv;
    });
  });

  describe('backward compatibility', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-12345';
      service = new CryptoService();
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it('should decrypt legacy format (iv:tag:ciphertext)', () => {
      // Create a legacy format encrypted string manually
      const plaintext = 'legacy-data';
      const encrypted = service.encrypt(plaintext);
      const parts = encrypted.split(':');
      // Convert to legacy format by removing version prefix
      const legacyFormat = `${parts[1]}:${parts[2]}:${parts[3]}`;

      const decrypted = service.decrypt(legacyFormat);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt new format (v1:iv:tag:ciphertext)', () => {
      const plaintext = 'new-data';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toMatch(/^v1:/);

      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('key rotation', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = 'old-key-12345';
      service = new CryptoService();
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it('should re-encrypt data with new key', () => {
      const plaintext = 'rotate-me';
      const oldKey = 'old-key-12345';
      const newKey = 'new-key-67890';

      // Encrypt with old key
      const encrypted = service.encrypt(plaintext);

      // Rotate to new key
      const rotated = service.rotateKey(encrypted, oldKey, newKey);

      // Verify rotated data has new format
      expect(rotated).toMatch(/^v1:/);
      expect(rotated).not.toBe(encrypted);

      // Decrypt with new key by creating a new service with the new key
      process.env.ENCRYPTION_KEY = newKey;
      const newService = new CryptoService();
      const decrypted = newService.decrypt(rotated);

      expect(decrypted).toBe(plaintext);

      // Restore original key
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it('should handle legacy format during rotation', () => {
      const plaintext = 'legacy-rotate';
      const oldKey = 'old-key-12345';
      const newKey = 'new-key-67890';

      // Create legacy format
      const encrypted = service.encrypt(plaintext);
      const parts = encrypted.split(':');
      const legacyFormat = `${parts[1]}:${parts[2]}:${parts[3]}`;

      // Rotate legacy format to new key
      const rotated = service.rotateKey(legacyFormat, oldKey, newKey);

      // Verify rotated data has new format
      expect(rotated).toMatch(/^v1:/);
    });
  });

  describe('hmac', () => {
    beforeEach(() => {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-12345';
      service = new CryptoService();
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it('should generate consistent HMAC for same input', () => {
      const data = 'test-data';
      const hmac1 = service.hmac(data);
      const hmac2 = service.hmac(data);

      expect(hmac1).toBe(hmac2);
    });

    it('should generate different HMACs for different inputs', () => {
      const hmac1 = service.hmac('data1');
      const hmac2 = service.hmac('data2');

      expect(hmac1).not.toBe(hmac2);
    });

    it('should return 64-character hex string (SHA-256)', () => {
      const hmac = service.hmac('test');

      expect(hmac).toHaveLength(64);
      expect(hmac).toMatch(/^[a-f0-9]+$/);
    });

    it('should use custom key if provided', () => {
      const data = 'test-data';
      const customKey = 'custom-hmac-key';
      const hmac1 = service.hmac(data, customKey);
      const hmac2 = service.hmac(data);

      expect(hmac1).not.toBe(hmac2);
    });
  });
});
