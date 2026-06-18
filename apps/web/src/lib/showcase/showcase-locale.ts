'use client';

import { normalizeShowcaseLocale, type LandingLocale, type Locale } from '@dhanam/shared';

const LOCALE_STORAGE_KEY = 'dhanam_locale';
const LOCALE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/** Persist locale for app.dhan.am embed sessions (cookie + localStorage). */
export function persistShowcaseLocale(locale: LandingLocale): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale};path=/;max-age=${LOCALE_COOKIE_MAX_AGE_S};SameSite=Lax`;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  document.documentElement.lang = locale;
}

export function resolveShowcaseLocaleFromSearch(
  raw: string | null | undefined
): LandingLocale | null {
  if (!raw) {
    return null;
  }
  return normalizeShowcaseLocale(raw);
}

export function toAppLocale(locale: LandingLocale): Locale {
  return locale;
}
