'use client';

import type { LandingLocale } from '@dhanam/shared';

import { HERO_TABLET_SCENE_HEIGHT, HERO_TABLET_SCREEN_INSET_CLASSES } from './hero-tablet-layout';

interface HeroTabletSkeletonProps {
  locale: LandingLocale;
}

/** Placeholder matching final tablet dimensions — avoids iframe flash before hydration. */
export function HeroTabletSkeleton({ locale: _locale }: HeroTabletSkeletonProps) {
  return (
    <div
      data-hero-tablet-skeleton
      className="relative mx-auto w-full max-w-[420px] max-lg:rounded-[1.75rem] max-lg:border max-lg:border-border/70 max-lg:bg-gradient-to-b max-lg:from-muted/40 max-lg:to-muted/20 max-lg:p-3 max-lg:shadow-2xl lg:h-[var(--hero-tablet-height)]"
      style={{ ['--hero-tablet-height' as string]: HERO_TABLET_SCENE_HEIGHT }}
      aria-hidden
    >
      <div
        className={`relative h-full w-full max-lg:aspect-[820/1100] lg:absolute ${HERO_TABLET_SCREEN_INSET_CLASSES}`}
      >
        <div className="h-full w-full animate-pulse rounded-[1.2rem] bg-muted/50 lg:rounded-[0.85rem]" />
      </div>
    </div>
  );
}
