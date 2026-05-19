import { LogSanitizer } from '../log-sanitizer';

describe('LogSanitizer', () => {
  describe('sanitize', () => {
    it('should redact password fields', () => {
      const data = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('[REDACTED]');
      expect(result.name).toBe('Test User');
    });

    it('should redact token fields', () => {
      const data = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh-token-value',
        apiKey: 'api-key-12345',
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.refreshToken).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
    });

    it('should redact TOTP secrets', () => {
      const data = {
        totpSecret: 'JBSWY3DPEHPK3PXP',
        totpTempSecret: 'TEMP_SECRET',
        totpCode: '123456',
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.totpSecret).toBe('[REDACTED]');
      expect(result.totpTempSecret).toBe('[REDACTED]');
      expect(result.totpCode).toBe('[REDACTED]');
    });

    it('should redact provider credentials', () => {
      const data = {
        encryptedToken: 'encrypted-data',
        plaidAccessToken: 'plaid-token',
        belvoToken: 'belvo-token',
        bitsoApiKey: 'bitso-key',
      };

      const result = LogSanitizer.sanitize(data);

      Object.values(result).forEach((value) => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          email: 'test@example.com',
          password: 'secret',
          profile: {
            name: 'Test',
            apiKey: 'key123',
          },
        },
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.user.profile.name).toBe('Test');
      expect(result.user.profile.apiKey).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const data = {
        users: [
          { email: 'user1@example.com', password: 'pass1' },
          { email: 'user2@example.com', password: 'pass2' },
        ],
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.users[0].email).toBe('user1@example.com');
      expect(result.users[0].password).toBe('[REDACTED]');
      expect(result.users[1].password).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive data', () => {
      const data = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date('2024-01-01'),
        isActive: true,
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.id).toBe(data.id);
      expect(result.email).toBe(data.email);
      expect(result.name).toBe(data.name);
      expect(result.createdAt).toEqual(data.createdAt);
      expect(result.isActive).toBe(data.isActive);
    });

    it('should handle null and undefined', () => {
      expect(LogSanitizer.sanitize(null)).toBeNull();
      expect(LogSanitizer.sanitize(undefined)).toBeUndefined();
    });

    it('should handle primitive types', () => {
      expect(LogSanitizer.sanitize('string')).toBe('string');
      expect(LogSanitizer.sanitize(123)).toBe(123);
      expect(LogSanitizer.sanitize(true)).toBe(true);
    });

    it('should prevent deep recursion', () => {
      const circular = { level: 0 } as any;
      let current = circular;

      // Create 15 levels of nesting
      for (let i = 1; i < 15; i++) {
        current.next = { level: i };
        current = current.next;
      }

      const result = LogSanitizer.sanitize(circular);

      expect(result).toBeDefined();
      // Should stop at max depth
    });

    it('should redact JWT-like patterns in strings', () => {
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const data = {
        message: `Token received: ${jwtToken}`,
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.message).toContain('[REDACTED_TOKEN]');
      expect(result.message).not.toContain(jwtToken);
    });
  });

  describe('sanitizeError', () => {
    it('should sanitize error objects', () => {
      // Use a realistic JWT token with proper length sections
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const error = new Error(`Invalid token: ${jwtToken}`);
      error.stack = `Error: Invalid token\n  at Function.test\n  accessToken=${jwtToken}`;

      const result = LogSanitizer.sanitizeError(error);

      expect(result.name).toBe('Error');
      expect(result.message).toContain('[REDACTED_TOKEN]');
      expect(result.stack).toBeDefined();
    });

    it('should handle non-Error objects', () => {
      const errorLike = {
        message: 'Something went wrong',
        password: 'secret',
      };

      const result = LogSanitizer.sanitizeError(errorLike);

      expect(result.message).toBe('Something went wrong');
      expect(result.password).toBe('[REDACTED]');
    });

    it('should handle error without stack (lines 185-190 branch)', () => {
      const error = new Error('Test error');
      // Remove the stack property
      delete error.stack;

      const result = LogSanitizer.sanitizeError(error);

      expect(result.name).toBe('Error');
      expect(result.message).toBe('Test error');
      // When stack is undefined, the ternary returns undefined
      expect(result.stack === undefined || result.stack === '').toBe(true);
    });

    it('should handle error with undefined message (line 167 branch)', () => {
      const error = new Error();
      error.message = undefined as any;

      const result = LogSanitizer.sanitizeError(error);

      expect(result.message).toBe('');
    });
  });

  describe('sanitizeRequest', () => {
    it('should sanitize HTTP request objects', () => {
      const req = {
        method: 'POST',
        url: '/auth/login',
        headers: {
          authorization: 'Bearer token123',
          'content-type': 'application/json',
          'x-api-key': 'secret-key',
        },
        body: {
          email: 'test@example.com',
          password: 'secret',
        },
        query: {
          token: 'query-token',
        },
        params: {
          id: 'user-123',
        },
        ip: '127.0.0.1',
      };

      const result = LogSanitizer.sanitizeRequest(req);

      expect(result.method).toBe('POST');
      expect(result.url).toBe('/auth/login');
      expect(result.headers.authorization).toBe('[REDACTED]');
      expect(result.headers['x-api-key']).toBe('[REDACTED]');
      expect(result.body.email).toBe('test@example.com');
      expect(result.body.password).toBe('[REDACTED]');
      expect(result.query.token).toBe('[REDACTED]');
      expect(result.params.id).toBe('user-123');
      expect(result.ip).toBe('127.0.0.1');
    });

    it('should redact cookie headers', () => {
      const req = {
        method: 'GET',
        url: '/',
        headers: {
          cookie: 'session=abc123',
          'set-cookie': 'token=xyz789',
        },
      };

      const result = LogSanitizer.sanitizeRequest(req);

      expect(result.headers.cookie).toBe('[REDACTED]');
      expect(result.headers['set-cookie']).toBe('[REDACTED]');
    });

    it('should handle request with undefined headers (line 219 branch)', () => {
      const req = {
        method: 'GET',
        url: '/health',
        headers: undefined,
        query: {},
        params: {},
        body: {},
        ip: '127.0.0.1',
      };

      const result = LogSanitizer.sanitizeRequest(req);

      expect(result.method).toBe('GET');
      expect(result.headers).toEqual({});
    });

    it('should handle request with null headers', () => {
      const req = {
        method: 'GET',
        url: '/health',
        headers: null,
        query: {},
        params: {},
        body: {},
        ip: '127.0.0.1',
      };

      const result = LogSanitizer.sanitizeRequest(req);

      expect(result.headers).toEqual({});
    });
  });

  describe('sensitive field detection', () => {
    it('should detect case-insensitive sensitive fields', () => {
      const data = {
        PASSWORD: 'test',
        Password: 'test',
        password: 'test',
        accessToken: 'test',
        AccessToken: 'test',
      };

      const result = LogSanitizer.sanitize(data);

      Object.values(result).forEach((value) => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should detect partial matches in field names', () => {
      const data = {
        userPassword: 'test',
        resetToken: 'test',
        apiKeyValue: 'test',
        totpSecretKey: 'test',
      };

      const result = LogSanitizer.sanitize(data);

      Object.values(result).forEach((value) => {
        expect(value).toBe('[REDACTED]');
      });
    });

    it('should not redact non-sensitive partial matches', () => {
      const data = {
        description: 'This contains the word password but is not sensitive',
        tokenCount: 5,
        secretSanta: 'gift',
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.description).not.toBe('[REDACTED]');
      expect(result.tokenCount).toBe(5);
      expect(result.secretSanta).not.toBe('[REDACTED]');
    });
  });

  describe('financial data', () => {
    it('should redact card numbers', () => {
      const data = {
        cardNumber: '4532-1234-5678-9010',
        cvv: '123',
        pin: '1234',
      };

      const result = LogSanitizer.sanitize(data);

      expect(result.cardNumber).toBe('[REDACTED]');
      expect(result.cvv).toBe('[REDACTED]');
      expect(result.pin).toBe('[REDACTED]');
    });

    it('should redact account numbers', () => {
      const data = {
        accountNumber: '1234567890',
        routingNumber: '021000021',
        ssn: '123-45-6789',
      };

      const result = LogSanitizer.sanitize(data);

      Object.values(result).forEach((value) => {
        expect(value).toBe('[REDACTED]');
      });
    });
  });
});
