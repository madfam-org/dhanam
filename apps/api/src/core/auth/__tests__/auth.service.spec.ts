import {
  RegisterDto,
  LoginDto,
  ResetPasswordDto,
  RefreshTokenDto,
  ForgotPasswordDto,
} from '@dhanam/shared';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';

import { AuditService } from '@core/audit/audit.service';
import { SecurityConfigService } from '@core/config/security.config';
import { LoggerService } from '@core/logger/logger.service';
import { PrismaService } from '@core/prisma/prisma.service';
import { EmailService } from '@modules/email/email.service';

import { AuthService } from '../auth.service';
import { SessionService } from '../session.service';
import { TotpService } from '../totp.service';

const mockRedisClient = {
  get: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  set: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedisClient));

describe('AuthService', () => {
  let service: AuthService;
  let module: TestingModule;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let sessionService: jest.Mocked<SessionService>;
  let totpService: jest.Mocked<TotpService>;
  let emailService: jest.Mocked<EmailService>;
  let logger: jest.Mocked<LoggerService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$hashedpassword',
    totpSecret: null,
    totpEnabled: false,
    isActive: true,
    locale: 'es',
    timezone: 'America/Mexico_City',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
    emailVerified: true,
    onboardingCompleted: true,
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      space: {
        create: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockSessionService = {
      createRefreshToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      revokeRefreshToken: jest.fn(),
      revokeAllUserSessions: jest.fn(),
      createPasswordResetToken: jest.fn(),
      validatePasswordResetToken: jest.fn(),
    };

    const mockTotpService = {
      verifyToken: jest.fn(),
      verifyEncryptedToken: jest.fn(),
    };

    const mockEmailService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    const mockAuditService = {
      logSuspiciousActivity: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    };

    const mockSecurityConfig = {
      getJwtExpiry: jest.fn().mockReturnValue('15m'),
      getJwtExpirySeconds: jest.fn().mockReturnValue(900),
      getRefreshTokenExpiryDays: jest.fn().mockReturnValue(30),
      getRefreshTokenExpirySeconds: jest.fn().mockReturnValue(2592000),
      getRefreshTokenExpiryMs: jest.fn().mockReturnValue(2592000000),
      getMaxLoginAttempts: jest.fn().mockReturnValue(5),
      getAccountLockoutMinutes: jest.fn().mockReturnValue(15),
      getAccountLockoutSeconds: jest.fn().mockReturnValue(900),
      getPasswordBreachCheckTimeoutMs: jest.fn().mockReturnValue(5000),
    };

    // Mock fetch to prevent real HIBP API calls (password breach check)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(''),
    });

    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.expire.mockResolvedValue(1);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.quit.mockResolvedValue('OK');

    module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: TotpService, useValue: mockTotpService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: AuditService, useValue: mockAuditService },
        { provide: SecurityConfigService, useValue: mockSecurityConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    sessionService = module.get(SessionService);
    totpService = module.get(TotpService);
    emailService = module.get(EmailService);
    logger = module.get(LoggerService);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      name: 'New User',
      locale: 'es',
      timezone: 'America/Mexico_City',
    };

    it('should register a new user with hashed password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: registerDto.email,
          name: registerDto.name,
          locale: registerDto.locale,
          timezone: registerDto.timezone,
          passwordHash: expect.any(String),
        }),
      });

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 15 * 60,
      });
    });

    it('should use Argon2id with OWASP-compliant parameters', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.register(registerDto);

      // Verify Argon2id was called with correct params
      const createCall = prisma.user.create.mock.calls[0][0];
      const hashedPassword = createCall.data.passwordHash;

      expect(hashedPassword).toBeDefined();
      expect(typeof hashedPassword).toBe('string');

      // Verify password hash follows Argon2id format
      expect(hashedPassword).toMatch(/^\$argon2id\$/);
    });

    it('should create default personal space for new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.register(registerDto);

      expect(prisma.space.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: `${registerDto.name}'s Personal`,
          type: 'personal',
          currency: 'MXN',
          userSpaces: {
            create: {
              userId: mockUser.id,
              role: 'owner',
            },
          },
        }),
      });
    });

    it('should use default timezone when not provided (line 70 branch)', async () => {
      const dtoWithoutTimezone: RegisterDto = {
        email: 'notz@example.com',
        password: 'SecurePassword123!',
        name: 'No Timezone User',
        locale: 'en',
        // timezone not provided - should fall back to America/Mexico_City
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.register(dtoWithoutTimezone);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          timezone: 'America/Mexico_City',
        }),
      });
    });

    it('should send welcome email after registration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.register(registerDto);

      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith(mockUser.email, mockUser.name);
    });

    it('should reject duplicate emails', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should reject breached passwords during registration', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      // Mock fetch to return HIBP response containing the SHA1 suffix of 'SecurePassword123!'
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue('353F4B927FD953E5AF7C41084183E8CE5FB:42\nABCDEF1234567890:10'),
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        'This password has been found in a data breach'
      );
    });

    it('should allow registration when breach check API fails (fail-open)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');
      // Mock fetch to throw (network error)
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await service.register(registerDto);
      expect(result.accessToken).toBe('mock-access-token');
    });

    it('should use default locale "es" if not provided', async () => {
      const dtoWithoutLocale = { ...registerDto, locale: undefined };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.register(dtoWithoutLocale as RegisterDto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          locale: 'es',
          timezone: 'America/Mexico_City',
        }),
      });
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'SecurePassword123!',
    };

    it('should login with valid credentials', async () => {
      const userWithPassword = { ...mockUser, passwordHash: await argon2.hash(loginDto.password) };
      prisma.user.findUnique.mockResolvedValue(userWithPassword as any);
      prisma.user.update.mockResolvedValue(userWithPassword as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 15 * 60,
      });
    });

    it('should update lastLoginAt timestamp', async () => {
      const userWithPassword = { ...mockUser, passwordHash: await argon2.hash(loginDto.password) };
      prisma.user.findUnique.mockResolvedValue(userWithPassword as any);
      prisma.user.update.mockResolvedValue(userWithPassword as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.login(loginDto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should reject login when account is locked', async () => {
      // Override the redis.get mock to return 'locked' for the lockout key check
      mockRedisClient.get.mockReset();
      mockRedisClient.get.mockResolvedValue('locked');

      await expect(service.login(loginDto)).rejects.toThrow('Account temporarily locked');
    });

    it('should lock account after max failed login attempts', async () => {
      // User not found → triggers recordFailedLogin
      prisma.user.findUnique.mockResolvedValue(null);
      // Override redis.incr to return MAX_LOGIN_ATTEMPTS (5)
      mockRedisClient.incr.mockReset();
      mockRedisClient.incr.mockResolvedValue(5);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
      // Verify lockout was set via redis.set
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `lockout:${loginDto.email}`,
        'locked',
        'EX',
        expect.any(Number)
      );
    });

    it('should reject invalid passwords', async () => {
      const userWithPassword = {
        ...mockUser,
        passwordHash: await argon2.hash('DifferentPassword'),
      };
      prisma.user.findUnique.mockResolvedValue(userWithPassword as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject non-existent users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject inactive users', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
        passwordHash: await argon2.hash(loginDto.password),
      };
      prisma.user.findUnique.mockResolvedValue(inactiveUser as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should require TOTP code when 2FA is enabled', async () => {
      const userWith2FA = {
        ...mockUser,
        totpSecret: 'JBSWY3DPEHPK3PXP',
        passwordHash: await argon2.hash(loginDto.password),
      };
      prisma.user.findUnique.mockResolvedValue(userWith2FA as any);

      const loginWithout2FA = { ...loginDto, totpCode: undefined };

      await expect(service.login(loginWithout2FA)).rejects.toThrow(
        new UnauthorizedException('TOTP code required')
      );
    });

    it('should verify TOTP code when 2FA is enabled', async () => {
      const userWith2FA = {
        ...mockUser,
        totpSecret: 'JBSWY3DPEHPK3PXP',
        passwordHash: await argon2.hash(loginDto.password),
      };
      prisma.user.findUnique.mockResolvedValue(userWith2FA as any);
      prisma.user.update.mockResolvedValue(userWith2FA as any);
      totpService.verifyEncryptedToken.mockReturnValue(true);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      const loginWith2FA = { ...loginDto, totpCode: '123456' };
      const result = await service.login(loginWith2FA);

      expect(totpService.verifyEncryptedToken).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 15 * 60,
      });
    });

    it('should reject invalid TOTP codes', async () => {
      const userWith2FA = {
        ...mockUser,
        totpSecret: 'JBSWY3DPEHPK3PXP',
        passwordHash: await argon2.hash(loginDto.password),
      };
      prisma.user.findUnique.mockResolvedValue(userWith2FA as any);
      totpService.verifyEncryptedToken.mockReturnValue(false);

      const loginWith2FA = { ...loginDto, totpCode: '999999' };

      await expect(service.login(loginWith2FA)).rejects.toThrow(
        new UnauthorizedException('Invalid TOTP code')
      );
    });
  });

  describe('refreshTokens', () => {
    const refreshDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should generate new tokens with valid refresh token', async () => {
      sessionService.validateRefreshToken.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      sessionService.revokeRefreshToken.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue('new-access-token');
      sessionService.createRefreshToken.mockResolvedValue('new-refresh-token');

      const result = await service.refreshTokens(refreshDto);

      expect(sessionService.validateRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(sessionService.revokeRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 15 * 60,
      });
    });

    it('should reject invalid refresh tokens', async () => {
      sessionService.validateRefreshToken.mockResolvedValue(null);

      await expect(service.refreshTokens(refreshDto)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token')
      );
      expect(sessionService.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('should rotate refresh tokens (invalidate old token)', async () => {
      sessionService.validateRefreshToken.mockResolvedValue({
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      sessionService.revokeRefreshToken.mockResolvedValue(undefined);
      jwtService.sign.mockReturnValue('new-access-token');
      sessionService.createRefreshToken.mockResolvedValue('new-refresh-token');

      await service.refreshTokens(refreshDto);

      // Verify old token was revoked before creating new one
      expect(sessionService.revokeRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(sessionService.createRefreshToken).toHaveBeenCalledWith(
        'user-123',
        'test@example.com'
      );
    });
  });

  describe('logout', () => {
    it('should revoke refresh token on logout', async () => {
      sessionService.revokeRefreshToken.mockResolvedValue(undefined);

      await service.logout('refresh-token-to-revoke');

      expect(sessionService.revokeRefreshToken).toHaveBeenCalledWith('refresh-token-to-revoke');
      expect(logger.log).toHaveBeenCalledWith('User logged out', 'AuthService');
    });
  });

  describe('forgotPassword', () => {
    const forgotDto: ForgotPasswordDto = {
      email: 'test@example.com',
    };

    it('should create reset token and send email for existing user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      sessionService.createPasswordResetToken.mockResolvedValue('reset-token-123');

      await service.forgotPassword(forgotDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: forgotDto.email },
      });
      expect(sessionService.createPasswordResetToken).toHaveBeenCalledWith(mockUser.id);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        'reset-token-123'
      );
    });

    it('should not reveal if email does not exist (security)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.forgotPassword(forgotDto);

      expect(sessionService.createPasswordResetToken).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      // Should return successfully without error
    });
  });

  describe('resetPassword', () => {
    const resetDto: ResetPasswordDto = {
      token: 'valid-reset-token',
      newPassword: 'NewSecurePassword456!',
    };

    it('should reset password with valid token', async () => {
      sessionService.validatePasswordResetToken.mockResolvedValue('user-123');
      prisma.user.update.mockResolvedValue(mockUser as any);
      sessionService.revokeAllUserSessions.mockResolvedValue(undefined);

      await service.resetPassword(resetDto);

      expect(sessionService.validatePasswordResetToken).toHaveBeenCalledWith('valid-reset-token');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { passwordHash: expect.any(String) },
      });
    });

    it('should use Argon2id for password hashing', async () => {
      sessionService.validatePasswordResetToken.mockResolvedValue('user-123');
      prisma.user.update.mockResolvedValue(mockUser as any);
      sessionService.revokeAllUserSessions.mockResolvedValue(undefined);

      await service.resetPassword(resetDto);

      const updateCall = prisma.user.update.mock.calls[0][0];
      const newPasswordHash = updateCall.data.passwordHash;

      expect(newPasswordHash).toMatch(/^\$argon2id\$/);
    });

    it('should revoke all user sessions after password reset', async () => {
      sessionService.validatePasswordResetToken.mockResolvedValue('user-123');
      prisma.user.update.mockResolvedValue(mockUser as any);
      sessionService.revokeAllUserSessions.mockResolvedValue(undefined);

      await service.resetPassword(resetDto);

      expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith('user-123');
    });

    it('should reject invalid reset tokens', async () => {
      sessionService.validatePasswordResetToken.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        new BadRequestException('Invalid or expired reset token')
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject expired reset tokens', async () => {
      sessionService.validatePasswordResetToken.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        new BadRequestException('Invalid or expired reset token')
      );
    });

    it('should reject breached passwords during password reset', async () => {
      sessionService.validatePasswordResetToken.mockResolvedValue('user-123');
      // Reset fetch mock and set it to return HIBP response with the SHA1 suffix of 'NewSecurePassword456!'
      (global.fetch as jest.Mock).mockReset();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: jest
          .fn()
          .mockResolvedValue('0482E8AC51130E934F0C2F43668E433AE7A:15\nABCDEF1234567890:10'),
      });

      await expect(service.resetPassword(resetDto)).rejects.toThrow(
        'This password has been found in a data breach'
      );
    });
  });

  describe('validateUser', () => {
    const email = 'test@example.com';
    const password = 'SecurePassword123!';

    it('should return user data (without password) for valid credentials', async () => {
      const userWithPassword = {
        ...mockUser,
        passwordHash: await argon2.hash(password),
      };
      prisma.user.findUnique.mockResolvedValue(userWithPassword as any);

      const result = await service.validateUser(email, password);

      // Service returns user object without passwordHash
      expect(result).toBeDefined();
      if (!result) {
        throw new Error('Expected validateUser to return a user');
      }
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.totpSecret).toBeNull();
      expect(result.isActive).toBe(true);
      expect((result as any).passwordHash).toBeUndefined();
      expect(result.passwordHash).toBeUndefined();
    });

    it('should return null for invalid password', async () => {
      const userWithPassword = {
        ...mockUser,
        passwordHash: await argon2.hash('DifferentPassword'),
      };
      prisma.user.findUnique.mockResolvedValue(userWithPassword as any);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it('should return null for inactive user', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
        passwordHash: await argon2.hash(password),
      };
      prisma.user.findUnique.mockResolvedValue(inactiveUser as any);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });
  });

  describe('token generation', () => {
    it('should generate access token with 15-minute expiration', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
        locale: 'es',
        timezone: 'America/Mexico_City',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);

      let capturedPayload: any;
      jwtService.sign.mockImplementation((payload) => {
        capturedPayload = payload;
        return 'mock-access-token';
      });

      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      const result = await service.register(registerDto);

      expect(capturedPayload).toMatchObject({
        sub: mockUser.id,
        email: mockUser.email,
      });
      // exp and iat are now handled by JWT module's signOptions (expiresIn: '15m')
      // so we only verify the result's expiresIn matches expected value
      expect(result.expiresIn).toBe(15 * 60);
    });

    it('should generate refresh token with 30-day expiration', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User',
        locale: 'es',
        timezone: 'America/Mexico_City',
      };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser as any);
      prisma.space.create.mockResolvedValue({} as any);
      jwtService.sign.mockReturnValue('mock-access-token');
      sessionService.createRefreshToken.mockResolvedValue('mock-refresh-token');

      await service.register(registerDto);

      expect(sessionService.createRefreshToken).toHaveBeenCalledWith(mockUser.id, mockUser.email);
    });
  });
});
