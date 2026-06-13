'use client';

import { useMemo } from 'react';

import {
  resolvePublicAdminUrl,
  resolvePublicApiUrl,
  resolvePublicAppUrl,
} from '@/lib/routing/public-surface';

function resolveFromBrowser<T>(
  resolver: (hostname: string, baked?: string) => T,
  baked?: string
): T {
  if (typeof window === 'undefined') {
    return resolver('', baked);
  }

  return resolver(window.location.hostname, baked);
}

export function usePublicAppUrl(): string {
  return useMemo(
    () => resolveFromBrowser(resolvePublicAppUrl, process.env.NEXT_PUBLIC_BASE_URL),
    []
  );
}

export function usePublicApiUrl(): string {
  return useMemo(
    () => resolveFromBrowser(resolvePublicApiUrl, process.env.NEXT_PUBLIC_API_URL),
    []
  );
}

export function usePublicAdminUrl(): string {
  return useMemo(
    () =>
      resolveFromBrowser(
        resolvePublicAdminUrl,
        process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.dhan.am'
      ),
    []
  );
}
