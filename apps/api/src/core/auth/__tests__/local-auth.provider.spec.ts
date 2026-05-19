import {
  AuthTokens,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from '@dhanam/shared';

import { AuthService } from '../auth.service';
import { LocalAuthProvider } from '../providers/local-auth.provider';

describe('LocalAuthProvider', () => {
  let provider: LocalAuthProvider;
  let authService: jest.Mocked<AuthService>;

  const mockTokens: AuthTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    expiresIn: 900,
  };

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue(mockTokens),
      login: jest.fn().mockResolvedValue(mockTokens),
      refreshTokens: jest.fn().mockResolvedValue(mockTokens),
      logout: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue(undefined),
      resetPassword: jest.fn().mockResolvedValue(undefined),
      validateUser: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    provider = new LocalAuthProvider(authService);
  });

  describe('register', () => {
    it('should delegate to AuthService.register', async () => {
      const dto: RegisterDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        name: 'Test User',
      };

      const result = await provider.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTokens);
    });
  });

  describe('login', () => {
    it('should delegate to AuthService.login', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
      };

      const result = await provider.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTokens);
    });

    it('should pass TOTP code through to AuthService', async () => {
      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        totpCode: '123456',
      };

      await provider.login(dto);

      expect(authService.login).toHaveBeenCalledWith(dto);
    });
  });

  describe('refreshTokens', () => {
    it('should wrap refreshToken string into RefreshTokenDto', async () => {
      const result = await provider.refreshTokens('my-refresh-token');

      expect(authService.refreshTokens).toHaveBeenCalledWith({
        refreshToken: 'my-refresh-token',
      });
      expect(result).toEqual(mockTokens);
    });
  });

  describe('logout', () => {
    it('should delegate to AuthService.logout', async () => {
      await provider.logout('my-refresh-token');

      expect(authService.logout).toHaveBeenCalledWith('my-refresh-token');
    });
  });

  describe('forgotPassword', () => {
    it('should delegate to AuthService.forgotPassword', async () => {
      const dto: ForgotPasswordDto = { email: 'test@example.com' };

      await provider.forgotPassword(dto);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('resetPassword', () => {
    it('should delegate to AuthService.resetPassword', async () => {
      const dto: ResetPasswordDto = {
        token: 'reset-token-123',
        newPassword: 'NewSecureP@ss456',
      };

      await provider.resetPassword(dto);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('interface compliance', () => {
    it('should implement all AuthProvider methods', () => {
      expect(typeof provider.register).toBe('function');
      expect(typeof provider.login).toBe('function');
      expect(typeof provider.refreshTokens).toBe('function');
      expect(typeof provider.logout).toBe('function');
      expect(typeof provider.forgotPassword).toBe('function');
      expect(typeof provider.resetPassword).toBe('function');
    });
  });
});
