import { getPublicApiOrigin, resolvePublicApiUrl } from './public-surface';

const STATIC_CONNECT_SRC = [
  'https://analytics.madfam.io',
  'https://challenges.cloudflare.com',
  'https://cloudflareinsights.com',
  'https://*.ingest.sentry.io',
];

export function buildContentSecurityPolicy(hostname: string, bakedApiUrl?: string): string {
  const apiUrl = resolvePublicApiUrl(hostname, bakedApiUrl);
  const apiOrigin = getPublicApiOrigin(apiUrl);
  const oidcIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER || 'https://auth.madfam.io';

  const connectSrc = ["'self'", apiOrigin, oidcIssuer, ...STATIC_CONNECT_SRC].join(' ');

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.madfam.io https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
