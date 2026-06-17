'use client';

import type { LandingLocale } from '@dhanam/shared';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';

import { HeroEmbedFrame } from './hero-embed-frame';
import { isHeroIpad3dEnabled, isHeroIpadEnabled } from './hero-ipad-config';
import { HeroIpadFallback } from './hero-ipad-fallback';
import { HeroMobileShowcase } from './hero-mobile-showcase';

const IpadScene = dynamic(() => import('./ipad-scene').then((mod) => mod.IpadScene), {
  ssr: false,
  loading: () => <HeroIpadFallback locale="en" />,
});

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

  if (!isDesktop) {
    return <HeroMobileShowcase />;
  }

  const use3d = isHeroIpad3dEnabled() && !reducedMotion && hydrate3d;

  return (
    <div data-hero-ipad-root className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {use3d ? (
        <IpadScene locale={locale} />
      ) : (
        <div className="relative">
          <HeroIpadFallback locale={locale} />
          <div className="absolute inset-[12%] overflow-hidden rounded-[1.1rem]">
            <HeroEmbedFrame locale={locale} className="h-full rounded-none border-0 shadow-none" />
          </div>
        </div>
      )}
    </div>
  );
}
