import { SHOWCASE_REQUEST_HEADER, SHOWCASE_REQUEST_HEADER_VALUE } from '@dhanam/shared';

const TRUSTED_SHOWCASE_HOSTS = new Set(['dhan.am', 'www.dhan.am', 'app.dhan.am', 'localhost']);

function hostFromHeader(value: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isTrustedShowcaseHost(hostname: string): boolean {
  return TRUSTED_SHOWCASE_HOSTS.has(hostname) || hostname.endsWith('.preview.dhan.am');
}

/**
 * True when the request is from the hero/tablet embed client and should bypass IP throttles.
 * The header is only set by our web app on /embed/demo routes; Origin/Referer are checked
 * when present, but omitted headers still bypass to avoid breaking the demo under strict
 * Referrer-Policy edge cases.
 */
export function isShowcaseRateLimitBypass(req: { headers?: Record<string, unknown> }): boolean {
  const headers = req.headers ?? {};
  const showcase = String(headers[SHOWCASE_REQUEST_HEADER] ?? headers['x-dhanam-showcase'] ?? '');

  if (showcase !== SHOWCASE_REQUEST_HEADER_VALUE) {
    return false;
  }

  const host =
    hostFromHeader(String(headers.origin ?? '')) ?? hostFromHeader(String(headers.referer ?? ''));

  if (!host) {
    return true;
  }

  return isTrustedShowcaseHost(host);
}
