import { EnvValidationService } from '../env-validation.service';

describe('EnvValidationService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Set all required vars to valid defaults
    process.env.JWT_SECRET = 'a-test-jwt-secret-that-is-at-least-32-chars-long';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.REDIS_HOST = 'localhost';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('onModuleInit / validateEnvironment', () => {
    it('should pass validation when all required vars are present', () => {
      expect(() => new EnvValidationService().onModuleInit()).not.toThrow();
    });

    it('should throw when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;

      expect(() => new EnvValidationService().onModuleInit()).toThrow(
        'ENVIRONMENT VALIDATION FAILED'
      );
    });

    it('should throw when DATABASE_URL is missing', () => {
      delete process.env.DATABASE_URL;

      expect(() => new EnvValidationService().onModuleInit()).toThrow(
        'ENVIRONMENT VALIDATION FAILED'
      );
    });

    it('should throw when REDIS_HOST is missing', () => {
      delete process.env.REDIS_HOST;

      expect(() => new EnvValidationService().onModuleInit()).toThrow(
        'ENVIRONMENT VALIDATION FAILED'
      );
    });

    it('should throw when JWT_SECRET is shorter than 32 characters', () => {
      process.env.JWT_SECRET = 'short-secret';

      expect(() => new EnvValidationService().onModuleInit()).toThrow(
        'Must be at least 32 characters'
      );
    });

    it('should throw when a required var is empty string', () => {
      process.env.JWT_SECRET = '   ';

      expect(() => new EnvValidationService().onModuleInit()).toThrow(
        'ENVIRONMENT VALIDATION FAILED'
      );
    });

    it('should report multiple missing variables at once', () => {
      delete process.env.JWT_SECRET;
      delete process.env.DATABASE_URL;

      try {
        new EnvValidationService().onModuleInit();
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('JWT_SECRET');
        expect(error.message).toContain('DATABASE_URL');
      }
    });
  });

  describe('requireEnvVar (static)', () => {
    it('should return the value when env var exists', () => {
      process.env.MY_VAR = 'my-value';

      const result = EnvValidationService.requireEnvVar('MY_VAR');

      expect(result).toBe('my-value');
    });

    it('should throw when env var is missing', () => {
      delete process.env.MISSING_VAR;

      expect(() => EnvValidationService.requireEnvVar('MISSING_VAR')).toThrow(
        'Missing required environment variable: MISSING_VAR'
      );
    });

    it('should include description in error message when provided', () => {
      delete process.env.API_KEY;

      expect(() => EnvValidationService.requireEnvVar('API_KEY', 'External API key')).toThrow(
        'Missing required environment variable: API_KEY (External API key)'
      );
    });

    it('should throw when env var is empty string', () => {
      process.env.EMPTY_VAR = '  ';

      expect(() => EnvValidationService.requireEnvVar('EMPTY_VAR')).toThrow(
        'Missing required environment variable: EMPTY_VAR'
      );
    });
  });

  describe('getEnvVar (static)', () => {
    it('should return the value when env var exists', () => {
      process.env.OPTIONAL_VAR = 'real-value';

      const result = EnvValidationService.getEnvVar('OPTIONAL_VAR', 'default');

      expect(result).toBe('real-value');
    });

    it('should return default when env var is not set', () => {
      delete process.env.OPTIONAL_VAR;

      const result = EnvValidationService.getEnvVar('OPTIONAL_VAR', 'fallback');

      expect(result).toBe('fallback');
    });

    it('should return default when env var is empty string', () => {
      process.env.OPTIONAL_VAR = '';

      const result = EnvValidationService.getEnvVar('OPTIONAL_VAR', 'fallback');

      expect(result).toBe('fallback');
    });
  });
});
