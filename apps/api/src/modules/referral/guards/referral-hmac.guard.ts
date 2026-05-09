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
 * Referral HMAC Guard
 * =============================================================================
 * Verifies HMAC-SHA256 signatures on service-to-service referral event
 * requests. Services sign the JSON request body with REFERRAL_WEBHOOK_SECRET
 * and pass the hex digest in the `X-Referral-Signature` header.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * Falls back to BILLING_WEBHOOK_SECRET if REFERRAL_WEBHOOK_SECRET is not
 * configured, allowing a single shared secret during initial rollout.
 * =============================================================================
 */
@Injectable()
export class ReferralHmacGuard implements CanActivate {
  private readonly logger = new Logger(ReferralHmacGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature =
      (request.headers['x-phyndcrm-signature'] as string | undefined) ||
      (request.headers['x-referral-signature'] as string | undefined);

    if (!signature) {
      throw new UnauthorizedException(
        'Missing X-PhyndCRM-Signature or X-Referral-Signature header'
      );
    }

    const secret =
      this.config.get<string>('REFERRAL_WEBHOOK_SECRET') ||
      this.config.get<string>('BILLING_WEBHOOK_SECRET');

    if (!secret) {
      this.logger.error('Neither REFERRAL_WEBHOOK_SECRET nor BILLING_WEBHOOK_SECRET configured');
      throw new UnauthorizedException('Referral signature verification not configured');
    }

    const rawBody =
      typeof request.rawBody === 'string'
        ? request.rawBody
        : request.rawBody
          ? request.rawBody.toString()
          : JSON.stringify(request.body);

    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // Guard against length mismatch before timingSafeEqual
    if (signature.length !== expected.length) {
      throw new UnauthorizedException('Invalid referral signature');
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf-8'), Buffer.from(expected, 'utf-8'))) {
      throw new UnauthorizedException('Invalid referral signature');
    }

    return true;
  }
}
