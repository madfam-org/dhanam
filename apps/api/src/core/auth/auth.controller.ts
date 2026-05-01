import { AuditService } from '@core/audit/audit.service';
import { SecurityConfigService } from '@core/config/security.config';
import { ThrottleAuthGuard } from '@core/security/guards/throttle-auth.guard';
import {
  LoginDto,
  RegisterDto,
  AuthTokens,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RATE_LIMIT_PRESETS,
} from '@dhanam/shared';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpStatus,
  HttpCode,
  Ip,
  Headers,
  Res,
  Inject,
  UnauthorizedException,
  GoneException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';

import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { DemoAuthService } from './demo-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GuestAuthService } from './guest-auth.service';
import { AUTH_PROVIDER, AuthProvider, MFA_PROVIDER, MfaProvider } from './providers';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AUTH_PROVIDER)
    private authProvider: AuthProvider,
    @Inject(MFA_PROVIDER)
    private mfaProvider: MfaProvider,
    private auditService: AuditService,
    private guestAuthService: GuestAuthService,
    private demoAuthService: DemoAuthService,
    private securityConfig: SecurityConfigService
  ) {}

  /**
   * Returns true when local auth endpoints (login, register, forgot/reset
   * password) should be disabled — i.e. when Janua SSO is the active auth
   * provider or local auth has been explicitly turned off.
   */
  private isLocalAuthDisabled(): boolean {
    return process.env.AUTH_MODE === 'janua' || process.env.ENABLE_LOCAL_AUTH === 'false';
  }

  /**
   * Throws a 410 Gone response directing the client to Janua SSO.
   * Used as a guard at the top of local-auth-only endpoints.
   */
  private throwLocalAuthDisabled(): never {
    throw new GoneException({
      redirect: 'https://auth.madfam.io',
      message: 'Local auth disabled. Use SSO.',
    });
  }

  @Post('register')
  @UseGuards(ThrottleAuthGuard)
  @Throttle({
    default: {
      limit: RATE_LIMIT_PRESETS.registration.limit,
      ttl: RATE_LIMIT_PRESETS.registration.ttl * 1000,
    },
  })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
  })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: FastifyReply
  ): Promise<{ tokens: { accessToken: string; expiresIn: number } }> {
    if (this.isLocalAuthDisabled()) this.throwLocalAuthDisabled();

    const tokens = await this.authProvider.register(dto);

    // Set refresh token as httpOnly cookie
    res.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth/refresh',
      maxAge: this.securityConfig.getRefreshTokenExpirySeconds(),
    });

    // Log successful registration
    await this.auditService.logEvent({
      action: 'USER_REGISTERED',
      resource: 'user',
      ipAddress: ip,
      userAgent,
      metadata: { email: dto.email },
      severity: 'medium',
    });

    return {
      tokens: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Post('login')
  @UseGuards(ThrottleAuthGuard)
  @Throttle({
    default: { limit: RATE_LIMIT_PRESETS.login.limit, ttl: RATE_LIMIT_PRESETS.login.ttl * 1000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Res({ passthrough: true }) res: FastifyReply
  ): Promise<{ tokens: { accessToken: string; expiresIn: number } }> {
    if (this.isLocalAuthDisabled()) this.throwLocalAuthDisabled();

    try {
      const tokens = await this.authProvider.login(dto);

      // Set refresh token as httpOnly cookie
      res.setCookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/v1/auth/refresh',
        maxAge: this.securityConfig.getRefreshTokenExpirySeconds(),
      });

      await this.auditService.logAuthSuccess('pending', ip, userAgent);

      return {
        tokens: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
      };
    } catch (error) {
      await this.auditService.logAuthFailure(dto.email, ip, userAgent);
      throw error;
    }
  }

  @Post(['guest', 'demo/guest'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as guest for demo access' })
  @ApiResponse({
    status: 200,
    description: 'Guest session created successfully',
  })
  async guestLogin(
    @Body() body: { countryCode?: string },
    @Ip() _ip: string,
    @Headers('user-agent') _userAgent: string,
    @Headers('cf-ipcountry') cfCountry: string
  ): Promise<{
    tokens: AuthTokens;
    user: { id: string; email: string; name: string; isGuest: boolean };
    message: string;
  }> {
    const countryCode = body?.countryCode || cfCountry || undefined;
    const session = await this.guestAuthService.createGuestSession(countryCode);

    return {
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      },
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        isGuest: true,
      },
      message: 'Welcome to Dhanam demo! This is a read-only guest session.',
    };
  }

  @Post(['demo/login', 'demo/persona'])
  @UseGuards(ThrottleAuthGuard)
  @Throttle({
    default: {
      limit: RATE_LIMIT_PRESETS.demo_login.limit,
      ttl: RATE_LIMIT_PRESETS.demo_login.ttl * 1000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login as a demo persona' })
  @ApiResponse({ status: 200, description: 'Demo persona session created' })
  async demoLogin(
    @Body() body: { persona: string; countryCode?: string },
    @Headers('cf-ipcountry') cfCountry: string
  ): Promise<{
    tokens: AuthTokens;
    user: { id: string; email: string; name: string; isDemo: boolean; persona: string };
    persona: string;
    message: string;
  }> {
    const countryCode = body?.countryCode || cfCountry || undefined;
    const result = await this.demoAuthService.loginAsPersona(body.persona, countryCode);

    return {
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        isDemo: true,
        persona: result.persona,
      },
      persona: result.persona,
      message: `Welcome! You're exploring Dhanam as ${result.user.name}.`,
    };
  }

  @Post('demo/switch')
  @UseGuards(JwtAuthGuard, ThrottleAuthGuard)
  @Throttle({
    default: { limit: RATE_LIMIT_PRESETS.logout.limit, ttl: RATE_LIMIT_PRESETS.logout.ttl * 1000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch demo persona (requires existing demo JWT)' })
  @ApiResponse({ status: 200, description: 'Switched to new persona' })
  async demoSwitch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { persona: string }
  ): Promise<{
    tokens: AuthTokens;
    user: { id: string; email: string; name: string; isDemo: boolean; persona: string };
    persona: string;
    message: string;
  }> {
    const result = await this.demoAuthService.switchPersona(user.userId, body.persona);

    return {
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        isDemo: true,
        persona: result.persona,
      },
      persona: result.persona,
      message: `Switched to ${result.user.name}.`,
    };
  }

  @Get('demo/personas')
  @ApiOperation({ summary: 'List available demo personas' })
  @ApiResponse({ status: 200, description: 'Available personas' })
  async getPersonas() {
    return { personas: this.demoAuthService.getAvailablePersonas() };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refreshTokens(
    @Body() dto: RefreshTokenDto,
    @Headers('cookie') cookieHeader: string,
    @Res({ passthrough: true }) res: FastifyReply
  ): Promise<{ tokens: { accessToken: string; expiresIn: number } }> {
    // Prefer cookie over body
    let refreshToken = dto?.refreshToken;
    if (cookieHeader) {
      const match = cookieHeader.match(/refresh_token=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const tokens = await this.authProvider.refreshTokens(refreshToken);

    // Set new refresh token cookie
    res.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/v1/auth/refresh',
      maxAge: this.securityConfig.getRefreshTokenExpirySeconds(),
    });

    return {
      tokens: {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Headers('cookie') cookieHeader: string,
    @Res({ passthrough: true }) res: FastifyReply
  ): Promise<{ message: string }> {
    let refreshToken = dto?.refreshToken;
    if (cookieHeader) {
      const match = cookieHeader.match(/refresh_token=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    if (refreshToken) {
      await this.authProvider.logout(refreshToken);
    }

    // Clear refresh token cookie
    res.clearCookie('refresh_token', { path: '/v1/auth/refresh' });

    return { message: 'Logout successful' };
  }

  @Post('forgot-password')
  @UseGuards(ThrottleAuthGuard)
  @Throttle({
    default: {
      limit: RATE_LIMIT_PRESETS.password_reset_request.limit,
      ttl: RATE_LIMIT_PRESETS.password_reset_request.ttl * 1000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset email sent if user exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    if (this.isLocalAuthDisabled()) this.throwLocalAuthDisabled();

    await this.authProvider.forgotPassword(dto);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Post('reset-password')
  @UseGuards(ThrottleAuthGuard)
  @Throttle({
    default: {
      limit: RATE_LIMIT_PRESETS.password_reset_confirm.limit,
      ttl: RATE_LIMIT_PRESETS.password_reset_confirm.ttl * 1000,
    },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    if (this.isLocalAuthDisabled()) this.throwLocalAuthDisabled();

    await this.authProvider.resetPassword(dto);
    return { message: 'Password reset successful' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post('totp/setup')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Setup TOTP 2FA' })
  @ApiResponse({ status: 201, description: 'TOTP setup initiated' })
  async setupTotp(@CurrentUser() user: AuthenticatedUser) {
    const setup = await this.mfaProvider.setupTotp(user.userId, user.email);
    return setup;
  }

  @Post('totp/enable')
  @UseGuards(JwtAuthGuard, ThrottleAuthGuard)
  @Throttle({
    default: {
      limit: RATE_LIMIT_PRESETS.totp_enable.limit,
      ttl: RATE_LIMIT_PRESETS.totp_enable.ttl * 1000,
    },
  })
  @ApiOperation({ summary: 'Enable TOTP 2FA' })
  @ApiResponse({ status: 200, description: 'TOTP enabled successfully' })
  async enableTotp(@CurrentUser() user: AuthenticatedUser, @Body() body: { token: string }) {
    await this.mfaProvider.enableTotp(user.userId, body.token);
    return { message: 'TOTP enabled successfully' };
  }

  @Post('totp/disable')
  @UseGuards(JwtAuthGuard, ThrottleAuthGuard)
  @Throttle({
    default: {
      limit: RATE_LIMIT_PRESETS.totp_disable.limit,
      ttl: RATE_LIMIT_PRESETS.totp_disable.ttl * 1000,
    },
  })
  @ApiOperation({ summary: 'Disable TOTP 2FA' })
  @ApiResponse({ status: 200, description: 'TOTP disabled successfully' })
  async disableTotp(@CurrentUser() user: AuthenticatedUser, @Body() body: { token: string }) {
    await this.mfaProvider.disableTotp(user.userId, body.token);
    return { message: 'TOTP disabled successfully' };
  }

  @Post('totp/backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate TOTP backup codes' })
  @ApiResponse({ status: 201, description: 'Backup codes generated' })
  async generateBackupCodes(@CurrentUser() user: AuthenticatedUser) {
    const codes = this.mfaProvider.generateBackupCodes();
    await this.mfaProvider.storeBackupCodes(user.userId, codes);
    return { codes };
  }
}
