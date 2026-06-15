/**
 * @deprecated Use LandingHeroStatic + LandingHeroActions via LandingPageClient.
 * Kept for incremental migration of any external imports.
 */
'use client';

import { LandingHeroActions } from '@/components/landing/landing-hero-actions';

interface HeroProps {
  onLiveDemoClick: () => void;
  onSignUpClick: () => void;
}

export function Hero({ onLiveDemoClick, onSignUpClick }: HeroProps) {
  return (
    <section className="container mx-auto px-6 py-16 md:py-24">
      <LandingHeroActions onLiveDemoClick={onLiveDemoClick} onSignUpClick={onSignUpClick} />
    </section>
  );
}
