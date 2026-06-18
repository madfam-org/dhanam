'use client';

import { useLocale } from '@dhanam/shared';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import {
  persistShowcaseLocale,
  resolveShowcaseLocaleFromSearch,
  toAppLocale,
} from './showcase-locale';

/**
 * Applies `?locale=` from the embed URL to I18nProvider on first paint.
 * Middleware also sets the cookie for SSR `lang` on app.dhan.am.
 */
export function useShowcaseLocaleSync(enabled: boolean): void {
  const searchParams = useSearchParams();
  const { setLocale } = useLocale();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const landingLocale = resolveShowcaseLocaleFromSearch(searchParams.get('locale'));
    if (!landingLocale) {
      return;
    }
    const appLocale = toAppLocale(landingLocale);
    setLocale(appLocale);
    persistShowcaseLocale(landingLocale);
  }, [enabled, searchParams, setLocale]);
}
