'use client';

import { useEffect, useState } from 'react';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';

const SLIDES = [
  { id: 'net-worth', label: 'Net worth' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'defi', label: 'DeFi' },
] as const;

const SLIDE_MS = 5200;

/**
 * Mobile hero — static product slides (no live iframe) for long-term perf stability.
 */
export function HeroMobileShowcase() {
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <div className="relative mx-auto w-full max-w-lg" aria-label="Dhanam product preview">
      <div className="mb-3 flex justify-center gap-2">
        {SLIDES.map((slide, slideIndex) => (
          <span
            key={slide.id}
            className={`h-1.5 w-8 rounded-full transition-colors ${
              slideIndex === index ? 'bg-primary' : 'bg-muted'
            }`}
            aria-hidden
          />
        ))}
      </div>
      <div className="transition-opacity duration-500">
        <HeroProductPreview />
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Preview: {SLIDES[index]?.label} — tap Try Live Demo for the full app
      </p>
    </div>
  );
}
