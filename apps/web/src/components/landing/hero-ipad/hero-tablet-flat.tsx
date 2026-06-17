'use client';

import type { LandingLocale } from '@dhanam/shared';

import { HeroTabletShell } from './hero-tablet-shell';

interface HeroTabletFlatProps {
  locale: LandingLocale;
  /** @deprecated Motion is handled by HeroTabletShell. */
  animate?: boolean;
}

/** @deprecated Use HeroTabletShell — kept for test compatibility. */
export function HeroTabletFlat({ locale }: HeroTabletFlatProps) {
  return <HeroTabletShell locale={locale} />;
}
