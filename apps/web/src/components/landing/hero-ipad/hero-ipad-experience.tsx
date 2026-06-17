'use client';

import type { LandingLocale } from '@dhanam/shared';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';

import { isHeroIpadEnabled } from './hero-ipad-config';
import { HeroTabletShell } from './hero-tablet-shell';

interface HeroIpadExperienceProps {
  locale: LandingLocale;
}

export function HeroIpadExperience({ locale }: HeroIpadExperienceProps) {
  if (!isHeroIpadEnabled()) {
    return <HeroProductPreview />;
  }

  return <HeroTabletShell locale={locale} />;
}
