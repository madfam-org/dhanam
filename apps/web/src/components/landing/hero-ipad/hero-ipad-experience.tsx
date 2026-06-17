'use client';

import type { LandingLocale } from '@dhanam/shared';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';

import { isHeroIpad3dEnabled, isHeroIpadEnabled } from './hero-ipad-config';
import { HeroTabletFlat } from './hero-tablet-flat';

const HeroTabletCompositor = dynamic(
  () => import('./hero-tablet-compositor').then((mod) => mod.HeroTabletCompositor),
  {
    ssr: false,
    loading: () => <HeroTabletFlat locale="en" animate />,
  }
);

interface HeroIpadExperienceProps {
  locale: LandingLocale;
}

function useViewport() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hydrate3d, setHydrate3d] = useState(false);

  useEffect(() => {
    const lg = window.matchMedia('(min-width: 1024px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const update = () => {
      setIsDesktop(lg.matches);
      setReducedMotion(motion.matches);
    };
    update();
    lg.addEventListener('change', update);
    motion.addEventListener('change', update);
    return () => {
      lg.removeEventListener('change', update);
      motion.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!isHeroIpad3dEnabled() || reducedMotion) {
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
  }, [reducedMotion]);

  return { isDesktop, reducedMotion, hydrate3d };
}

export function HeroIpadExperience({ locale }: HeroIpadExperienceProps) {
  const { isDesktop, reducedMotion, hydrate3d } = useViewport();

  if (!isHeroIpadEnabled()) {
    return <HeroProductPreview />;
  }

  const useCompositor = isDesktop && isHeroIpad3dEnabled() && !reducedMotion && hydrate3d;

  return (
    <div data-hero-ipad-root className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {useCompositor ? (
        <HeroTabletCompositor locale={locale} reducedMotion={reducedMotion} />
      ) : (
        <HeroTabletFlat locale={locale} animate={isDesktop} />
      )}
    </div>
  );
}
