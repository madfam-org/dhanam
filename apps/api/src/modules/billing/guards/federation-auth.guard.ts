import * as crypto from 'crypto';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * =============================================================================
 * Federation Authentication Guard
 * =============================================================================
 * Validates Bearer tokens for service-to-service federation calls.
 *
 * PhyndCRM (and other MADFAM ecosystem services) authenticate to the
 * customer federation endpoint using a shared secret token configured
 * via the FEDERATION_API_TOKEN environment variable.
 *
 * The token is compared using constant-time equality to prevent
 * timing attacks.
 * =============================================================================
 */
@Injectable()
export class FederationAuthGuard implements CanActivate {
  private readonly logger = new Logger(FederationAuthGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Federation request missing or malformed Authorization header');
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    const expectedToken = this.config.get<string>('FEDERATION_API_TOKEN');

    if (!expectedToken) {
      this.logger.error('FEDERATION_API_TOKEN is not configured');
      throw new UnauthorizedException('Federation authentication is not configured');
    }

    // Constant-time comparison to prevent timing attacks
    const tokenBuffer = Buffer.from(token, 'utf-8');
    const expectedBuffer = Buffer.from(expectedToken, 'utf-8');

    if (
      tokenBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
    ) {
      this.logger.warn('Federation request with invalid token');
      throw new UnauthorizedException('Invalid federation token');
    }

    return true;
  }
}
