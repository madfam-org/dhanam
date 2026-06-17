'use client';

import type { LandingLocale } from '@dhanam/shared';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { HeroEmbedFrame } from './hero-embed-frame';
import { isHeroIpad3dEnabled } from './hero-ipad-config';
import { HERO_TABLET_MAX_WIDTH_PX, HERO_TABLET_SCENE_HEIGHT } from './hero-tablet-layout';
import { HeroTabletSkeleton } from './hero-tablet-skeleton';
import { useHeroTabletMotion } from './use-hero-tablet-motion';

const HeroTabletBezelCanvas = dynamic(
  () => import('./hero-tablet-bezel-canvas').then((mod) => mod.HeroTabletBezelCanvas),
  { ssr: false }
);

interface HeroTabletShellProps {
  locale: LandingLocale;
}

function useHeroTabletShellState() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hydrate3d, setHydrate3d] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(motion.matches);
    updateMotion();
    motion.addEventListener('change', updateMotion);
    return () => motion.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    if (!mounted || !isHeroIpad3dEnabled() || reducedMotion) {
      return undefined;
    }

    const lg = window.matchMedia('(min-width: 1024px)');
    if (!lg.matches) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setHydrate3d(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px', threshold: 0.15 }
    );

    const target = document.querySelector('[data-hero-ipad-root]');
    if (target) {
      observer.observe(target);
    } else {
      setHydrate3d(true);
    }

    return () => observer.disconnect();
  }, [mounted, reducedMotion]);

  const show3dBezel = mounted && hydrate3d && isHeroIpad3dEnabled() && !reducedMotion;

  return { mounted, reducedMotion, show3dBezel };
}

/**
 * Unified hero tablet — one persistent iframe, optional WebGL bezel on desktop.
 * Avoids flat→compositor swaps that remount the embed and exhaust demo rate limits.
 */
export function HeroTabletShell({ locale }: HeroTabletShellProps) {
  const { mounted, reducedMotion, show3dBezel } = useHeroTabletShellState();
  const { transform, onPointerMove, onPointerLeave } = useHeroTabletMotion(reducedMotion);

  if (!mounted) {
    return <HeroTabletSkeleton locale={locale} />;
  }

  return (
    <div
      data-hero-ipad-root
      className="relative mx-auto w-full max-lg:max-w-lg"
      style={{ maxWidth: HERO_TABLET_MAX_WIDTH_PX }}
    >
      <div
        className="relative max-lg:rounded-[1.75rem] max-lg:border max-lg:border-border/70 max-lg:bg-gradient-to-b max-lg:from-muted/40 max-lg:to-muted/20 max-lg:p-3 max-lg:shadow-2xl max-lg:shadow-black/40 lg:h-[var(--hero-tablet-height)]"
        style={{ ['--hero-tablet-height' as string]: HERO_TABLET_SCENE_HEIGHT }}
        data-hero-tablet-shell
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div
          className="relative h-full w-full max-lg:aspect-[820/1100] lg:h-full"
          style={{
            transform: show3dBezel ? transform : undefined,
            transformStyle: show3dBezel ? 'preserve-3d' : undefined,
          }}
        >
          <div
            className="absolute -inset-4 rounded-[2rem] bg-primary/5 blur-2xl max-lg:block lg:hidden"
            aria-hidden
          />

          {!show3dBezel ? (
            <div
              className="pointer-events-none absolute inset-0 hidden rounded-[1.75rem] border border-border/70 bg-gradient-to-b from-muted/40 to-muted/20 lg:block"
              aria-hidden
            />
          ) : null}

          {show3dBezel ? (
            <div className="absolute inset-0 z-10 hidden lg:block" data-hero-tablet-bezel>
              <HeroTabletBezelCanvas />
            </div>
          ) : null}

          <div
            className="relative z-20 h-full w-full overflow-hidden max-lg:rounded-[1.2rem] max-lg:border max-lg:border-white/5 max-lg:bg-black/40 max-lg:ring-1 max-lg:ring-white/10 lg:absolute lg:top-[9.5%] lg:right-[10.5%] lg:bottom-[13.5%] lg:left-[10.5%] lg:rounded-[0.85rem] lg:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            data-hero-tablet-screen
          >
            <HeroEmbedFrame
              locale={locale}
              className="h-full w-full rounded-none border-0 shadow-none"
            />
          </div>

          {show3dBezel ? (
            <div
              className="pointer-events-none absolute inset-0 z-30 hidden rounded-[1.75rem] ring-1 ring-white/10 lg:block"
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
