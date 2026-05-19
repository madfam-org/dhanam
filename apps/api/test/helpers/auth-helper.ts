import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import * as speakeasy from 'speakeasy';

/**
 * Authentication Test Helper
 *
 * Provides utilities for testing authentication flows:
 * - JWT token generation
 * - Password hashing
 * - TOTP code generation
 * - Authenticated request helpers
 */
export class AuthHelper {
  private static jwtService: JwtService;

  /**
   * Initialize JWT service
   * - Call this in beforeAll() if you need JWT tokens
   */
  static initialize(jwtSecret?: string): void {
    this.jwtService = new JwtService({
      secret: jwtSecret || process.env.JWT_SECRET || 'test-secret',
    });
  }

  /**
   * Generate JWT access token for a user
   * - Returns a valid JWT token that can be used in Authorization headers
   */
  static generateAccessToken(userId: string, email: string, expiresIn = '15m'): string {
    if (!this.jwtService) {
      this.initialize();
    }

    return this.jwtService.sign(
      {
        sub: userId,
        email,
        iat: Math.floor(Date.now() / 1000),
      },
      { expiresIn }
    );
  }

  /**
   * Generate refresh token (longer lived)
   * - Returns a JWT token for refresh flow testing
   */
  static generateRefreshToken(userId: string, email: string, expiresIn = '30d'): string {
    if (!this.jwtService) {
      this.initialize();
    }

    return this.jwtService.sign(
      {
        sub: userId,
        email,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
      },
      { expiresIn }
    );
  }

  /**
   * Verify JWT token
   * - Returns decoded payload if valid
   * - Throws if invalid or expired
   */
  static verifyToken(token: string): any {
    if (!this.jwtService) {
      this.initialize();
    }

    return this.jwtService.verify(token);
  }

  /**
   * Hash password using Argon2id
   * - Use this to create user passwords for test data
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB (same as production)
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify password against hash
   * - Use this to test password verification
   */
  static async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Generate TOTP secret
   * - Returns a new TOTP secret for 2FA testing
   */
  static generateTotpSecret(userEmail: string): {
    secret: string;
    otpAuthUrl: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `Dhanam Test (${userEmail})`,
      issuer: 'Dhanam Ledger',
      length: 32,
    });

    return {
      secret: secret.base32!,
      otpAuthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Generate TOTP code from secret
   * - Use this to test TOTP verification
   */
  static generateTotpCode(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
    });
  }

  /**
   * Verify TOTP code
   * - Returns true if code is valid
   */
  static verifyTotpCode(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps for clock drift
    });
  }

  /**
   * Generate backup codes
   * - Returns array of 10 backup codes for 2FA
   */
  static generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = require('crypto').randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup code
   * - Backup codes are stored hashed in database
   */
  static hashBackupCode(code: string): string {
    return require('crypto').createHash('sha256').update(code).digest('hex');
  }

  /**
   * Create Authorization header
   * - Returns object with Authorization header set
   */
  static createAuthHeader(token: string): { Authorization: string } {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Create complete auth headers for test request
   * - Includes Authorization, Content-Type, etc.
   */
  static createRequestHeaders(
    userId: string,
    email: string,
    additionalHeaders: Record<string, string> = {}
  ): Record<string, string> {
    const token = this.generateAccessToken(userId, email);

    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
  }

  /**
   * Create mock user with authentication
   * - Returns user object with token and password
   * - Useful for integration tests
   */
  static async createAuthenticatedUser(overrides: Partial<User> = {}): Promise<{
    user: Partial<User>;
    password: string;
    passwordHash: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const password = 'TestPassword123!';
    const passwordHash = await this.hashPassword(password);

    const user = {
      id: overrides.id || require('crypto').randomUUID(),
      email: overrides.email || `test-${Date.now()}@example.com`,
      name: overrides.name || 'Test User',
      passwordHash,
      locale: overrides.locale || 'es',
      timezone: overrides.timezone || 'America/Mexico_City',
      emailVerified: overrides.emailVerified ?? true,
      isActive: overrides.isActive ?? true,
      totpEnabled: overrides.totpEnabled ?? false,
      ...overrides,
    };

    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id, user.email);

    return {
      user,
      password,
      passwordHash,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Create mock user with TOTP enabled
   * - Returns user with TOTP secret and current code
   */
  static async createAuthenticatedUserWithTotp(overrides: Partial<User> = {}): Promise<{
    user: Partial<User>;
    password: string;
    totpSecret: string;
    totpCode: string;
    backupCodes: string[];
    accessToken: string;
    refreshToken: string;
  }> {
    const authUser = await this.createAuthenticatedUser(overrides);
    const { secret } = this.generateTotpSecret(authUser.user.email!);
    const totpCode = this.generateTotpCode(secret);
    const backupCodes = this.generateBackupCodes();

    const user = {
      ...authUser.user,
      totpEnabled: true,
      totpSecret: secret,
      totpBackupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
    };

    return {
      user,
      password: authUser.password,
      totpSecret: secret,
      totpCode,
      backupCodes,
      accessToken: authUser.accessToken,
      refreshToken: authUser.refreshToken,
    };
  }

  /**
   * Wait for JWT to expire (for testing token expiration)
   * - Returns promise that resolves after token expires
   */
  static async waitForTokenExpiry(token: string): Promise<void> {
    try {
      const decoded = this.verifyToken(token);
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const waitTime = expiresAt - now + 1000; // Wait 1 second after expiry

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    } catch (error) {
      // Token already expired
    }
  }
}
