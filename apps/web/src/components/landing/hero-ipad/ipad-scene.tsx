'use client';

import type { LandingLocale } from '@dhanam/shared';

import { HeroTabletCompositor } from './hero-tablet-compositor';

interface IpadSceneProps {
  locale: LandingLocale;
  reducedMotion?: boolean;
}

/** @deprecated Name kept for dynamic import — renders HeroTabletCompositor. */
export function IpadScene({ locale, reducedMotion }: IpadSceneProps) {
  return <HeroTabletCompositor locale={locale} reducedMotion={reducedMotion} />;
}
