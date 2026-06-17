import { SHOWCASE_REQUEST_HEADER, SHOWCASE_REQUEST_HEADER_VALUE } from '@dhanam/shared';
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const SHOWCASE_REFERER_HOSTS = new Set(['dhan.am', 'www.dhan.am', 'app.dhan.am', 'localhost']);

function isTrustedShowcaseReferer(referer: string): boolean {
  if (!referer) {
    return false;
  }

  try {
    const { hostname } = new URL(referer);
    if (SHOWCASE_REFERER_HOSTS.has(hostname)) {
      return true;
    }
    return hostname.endsWith('.preview.dhan.am');
  } catch {
    return false;
  }
}

// Strict rate limiting for authentication endpoints
@Injectable()
export class ThrottleAuthGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Track by IP address for auth endpoints
    return req.ip || 'unknown';
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Record<string, any>>();
    const showcaseHeader = String(req.headers?.[SHOWCASE_REQUEST_HEADER] ?? '');

    if (showcaseHeader !== SHOWCASE_REQUEST_HEADER_VALUE) {
      return false;
    }

    const referer = String(req.headers?.referer ?? req.headers?.origin ?? '');
    return isTrustedShowcaseReferer(referer);
  }
}

@Injectable()
export class StrictThrottleGuard extends ThrottlerGuard {
  // For sensitive endpoints like password reset, TOTP setup
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Combine IP and user agent for more restrictive tracking
    const ip = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}-${userAgent}`;
  }
}
