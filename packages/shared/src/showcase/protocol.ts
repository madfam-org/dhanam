/**
 * Cross-origin showcase protocol between dhan.am (parent) and app.dhan.am/embed (child).
 */

import { normalizeLandingLocale, type LandingLocale } from '../i18n/translations-map';

export const SHOWCASE_MESSAGE_TYPE = 'dhanam:showcase' as const;

/** Sent by embed iframe API calls so auth throttles can skip trusted showcase traffic. */
export const SHOWCASE_REQUEST_HEADER = 'x-dhanam-showcase' as const;
export const SHOWCASE_REQUEST_HEADER_VALUE = '1' as const;

export type ShowcasePersona = 'maria' | 'patricia';

export type ShowcaseParentCommand =
  | { type: typeof SHOWCASE_MESSAGE_TYPE; action: 'navigate'; path: string }
  | {
      type: typeof SHOWCASE_MESSAGE_TYPE;
      action: 'highlight';
      target: string;
      durationMs?: number;
    }
  | {
      type: typeof SHOWCASE_MESSAGE_TYPE;
      action: 'scroll';
      y: number;
      behavior?: ScrollBehavior;
    }
  | {
      type: typeof SHOWCASE_MESSAGE_TYPE;
      action: 'cursor';
      points: Array<{ x: number; y: number }>;
      durationMs: number;
    }
  | { type: typeof SHOWCASE_MESSAGE_TYPE; action: 'pause' | 'resume' | 'restart' }
  | { type: typeof SHOWCASE_MESSAGE_TYPE; action: 'switch-persona'; persona: ShowcasePersona }
  | { type: typeof SHOWCASE_MESSAGE_TYPE; action: 'set-locale'; locale: LandingLocale };

export type ShowcaseChildEvent =
  | { type: typeof SHOWCASE_MESSAGE_TYPE; event: 'ready'; path: string; persona?: string }
  | { type: typeof SHOWCASE_MESSAGE_TYPE; event: 'route-changed'; path: string }
  | { type: typeof SHOWCASE_MESSAGE_TYPE; event: 'step-complete'; stepId: string }
  | { type: typeof SHOWCASE_MESSAGE_TYPE; event: 'error'; message: string };

export type ShowcaseTourStep = {
  id: string;
  path: string;
  dwellMs: number;
  highlightTarget?: string;
  scrollY?: number;
  cursorPoints?: Array<{ x: number; y: number }>;
};

export type ShowcaseTour = {
  id: string;
  persona: ShowcasePersona;
  steps: ShowcaseTourStep[];
};

/** Pause between tour steps (ms) — subtle breathing room during navigation. */
export const SHOWCASE_STEP_GAP_MS = 800;

/** Pause after a full tour loop before restarting or switching persona (ms). */
export const SHOWCASE_LOOP_BREAK_MS = 14_000;

/** Pause when switching persona between loops (ms). */
export const SHOWCASE_PERSONA_SWITCH_MS = 4_000;

const MARKETING_HOSTS = new Set(['dhan.am', 'www.dhan.am']);

export function isAllowedShowcaseParentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (MARKETING_HOSTS.has(url.hostname)) {
      return true;
    }
    if (url.hostname === 'localhost' && (url.port === '3040' || url.port === '')) {
      return true;
    }
    if (/^pr-\d+\.web\.preview\.dhan\.am$/i.test(url.hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isShowcaseMessage(
  value: unknown
): value is ShowcaseParentCommand | ShowcaseChildEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (value as { type?: string }).type === SHOWCASE_MESSAGE_TYPE;
}

export function normalizeShowcaseLocale(raw: string | null | undefined): LandingLocale {
  if (!raw) {
    return 'es';
  }
  return normalizeLandingLocale(raw);
}

export function buildEmbedDemoUrl(
  appUrl: string,
  options: {
    persona: ShowcasePersona;
    path?: string;
    showcase?: boolean;
    locale?: LandingLocale;
  }
): string {
  const base = appUrl.replace(/\/$/, '');
  const path = options.path ?? '/dashboard';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const params = new URLSearchParams({
    persona: options.persona,
    ...(options.showcase === false ? {} : { showcase: '1' }),
    ...(options.locale ? { locale: options.locale } : {}),
  });
  return `${base}/embed/demo${normalizedPath}?${params.toString()}`;
}
