import { timingSafeEqual } from 'crypto';

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Validates X-Dhanam-Catalog-Apply-Secret for internal Tulana/Selva apply calls.
 */
@Injectable()
export class CatalogApplySecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected =
      this.config.get<string>('DHANAM_CATALOG_APPLY_SECRET') ||
      this.config.get<string>('TULANA_SELVA_CATALOG_APPLY_SECRET') ||
      '';
    if (!expected) {
      throw new UnauthorizedException('Catalog apply secret not configured');
    }

    const request = context.switchToHttp().getRequest();
    const provided = String(request.headers['x-dhanam-catalog-apply-secret'] || '');
    if (!provided) {
      throw new UnauthorizedException('Missing X-Dhanam-Catalog-Apply-Secret');
    }

    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid catalog apply secret');
    }
    return true;
  }
}
