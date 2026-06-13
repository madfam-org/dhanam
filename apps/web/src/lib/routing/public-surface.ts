import { getHostnameFromHostHeader } from './hosts';

export type PublicSurfaceTier = 'local' | 'preview' | 'staging' | 'production';

const SURFACE_URLS = {
  production: {
    app: 'https://app.dhan.am',
    api: 'https://api.dhan.am/v1',
    admin: 'https://admin.dhan.am',
  },
  staging: {
    app: 'https://staging.dhan.am',
    api: 'https://staging-api.dhan.am/v1',
    admin: 'https://staging-admin.dhan.am',
  },
  local: {
    app: 'http://localhost:3040',
    api: 'http://localhost:4010/v1',
    admin: 'http://localhost:3400',
  },
} as const;

export function getPreviewPrNumber(hostname: string): string | null {
  const match = hostname.toLowerCase().match(/^pr-(\d+)\./);
  return match?.[1] ?? null;
}

export function getPublicSurfaceTier(hostname: string): PublicSurfaceTier {
  const host = hostname.toLowerCase();

  if (!host || host === 'localhost' || host.endsWith('.localhost')) {
    return 'local';
  }

  if (host.includes('.preview.dhan.am')) {
    return 'preview';
  }

  if (host === 'staging.dhan.am' || host.startsWith('staging-') || host.startsWith('staging.')) {
    return 'staging';
  }

  return 'production';
}

export function isMarketingHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'dhan.am' || host === 'www.dhan.am';
}

function tierFromPublicUrl(url: string | undefined): PublicSurfaceTier | null {
  if (!url) {
    return null;
  }

  const normalized = url.toLowerCase();

  if (normalized.includes('localhost')) {
    return 'local';
  }

  if (normalized.includes('.preview.dhan.am')) {
    return 'preview';
  }

  if (normalized.includes('staging-api') || normalized.includes('staging.dhan.am')) {
    return 'staging';
  }

  if (normalized.includes('dhan.am')) {
    return 'production';
  }

  return null;
}

function resolvePreviewSurface(hostname: string, surface: 'app' | 'api' | 'admin'): string | null {
  const pr = getPreviewPrNumber(hostname);
  if (!pr) {
    return null;
  }

  const suffix =
    surface === 'app'
      ? 'web.preview.dhan.am'
      : surface === 'api'
        ? 'api.preview.dhan.am/v1'
        : 'admin.preview.dhan.am';

  return `https://pr-${pr}.${suffix}`;
}

function resolveCanonicalSurface(
  tier: PublicSurfaceTier,
  surface: 'app' | 'api' | 'admin'
): string {
  if (tier === 'local') {
    return SURFACE_URLS.local[surface];
  }

  if (tier === 'staging') {
    return SURFACE_URLS.staging[surface];
  }

  return SURFACE_URLS.production[surface];
}

function resolveSurfaceUrl(
  hostname: string,
  surface: 'app' | 'api' | 'admin',
  bakedUrl?: string
): string {
  const previewUrl = resolvePreviewSurface(hostname, surface);
  if (previewUrl) {
    return previewUrl;
  }

  const tier = getPublicSurfaceTier(hostname);
  const canonical = resolveCanonicalSurface(tier, surface);

  if (surface === 'app' && isMarketingHostname(hostname)) {
    return canonical;
  }

  const bakedTier = tierFromPublicUrl(bakedUrl);
  if (bakedTier && bakedTier !== tier) {
    return canonical;
  }

  if (surface === 'app') {
    if (hostname === 'app.dhan.am' || hostname === 'staging.dhan.am') {
      return `https://${hostname}`;
    }
  }

  if (surface === 'admin') {
    if (hostname === 'admin.dhan.am' || hostname === 'staging-admin.dhan.am') {
      return `https://${hostname}`;
    }
  }

  return bakedUrl || canonical;
}

export function resolvePublicAppUrl(hostname: string, bakedUrl?: string): string {
  return resolveSurfaceUrl(hostname, 'app', bakedUrl);
}

export function resolvePublicApiUrl(hostname: string, bakedUrl?: string): string {
  return resolveSurfaceUrl(hostname, 'api', bakedUrl);
}

export function resolvePublicAdminUrl(hostname: string, bakedUrl?: string): string {
  return resolveSurfaceUrl(hostname, 'admin', bakedUrl);
}

export function resolvePublicSurfacesFromHostHeader(
  hostHeader: string | null | undefined,
  baked?: { appUrl?: string; apiUrl?: string; adminUrl?: string }
) {
  const hostname = getHostnameFromHostHeader(hostHeader);

  return {
    hostname,
    appUrl: resolvePublicAppUrl(hostname, baked?.appUrl),
    apiUrl: resolvePublicApiUrl(hostname, baked?.apiUrl),
    adminUrl: resolvePublicAdminUrl(hostname, baked?.adminUrl),
  };
}

export function getPublicApiOrigin(apiUrl: string): string {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return SURFACE_URLS.production.api.replace(/\/v1$/, '');
  }
}
