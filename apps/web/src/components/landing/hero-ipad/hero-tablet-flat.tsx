'use client';

import type { LandingLocale } from '@dhanam/shared';

import { HeroEmbedFrame } from './hero-embed-frame';

interface HeroTabletFlatProps {
  locale: LandingLocale;
  /** Subtle idle float on the frame (desktop compositor handles its own motion). */
  animate?: boolean;
}

/**
 * CSS tablet frame with a live embed iframe — no WebGL, stable on all viewports.
 */
export function HeroTabletFlat({ locale, animate = false }: HeroTabletFlatProps) {
  return (
    <div
      className={`relative mx-auto w-full max-w-lg lg:max-w-none ${animate ? 'hero-tablet-flat-float' : ''}`}
      data-hero-tablet-flat
    >
      <div className="absolute -inset-4 rounded-[2rem] bg-primary/5 blur-2xl" aria-hidden />
      <div className="relative rounded-[1.75rem] border border-border/70 bg-gradient-to-b from-muted/40 to-muted/20 p-3 shadow-2xl shadow-black/40">
        <div className="overflow-hidden rounded-[1.2rem] border border-white/5 bg-black/40 ring-1 ring-white/10">
          <HeroEmbedFrame
            locale={locale}
            className="h-full min-h-[280px] w-full rounded-none border-0 shadow-none md:min-h-[320px]"
          />
        </div>
      </div>
    </div>
  );
}
