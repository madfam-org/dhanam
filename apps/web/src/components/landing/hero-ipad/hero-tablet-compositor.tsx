'use client';

import type { LandingLocale } from '@dhanam/shared';

import { HeroTabletShell } from './hero-tablet-shell';

interface HeroTabletCompositorProps {
  locale: LandingLocale;
  reducedMotion?: boolean;
}

/** @deprecated Use HeroTabletShell — kept for test compatibility. */
export function HeroTabletCompositor({ locale }: HeroTabletCompositorProps) {
  return <HeroTabletShell locale={locale} />;
}
