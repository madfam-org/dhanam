import type { LandingLocale } from '@dhanam/shared';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';

interface HeroIpadFallbackProps {
  locale: LandingLocale;
}

/** SSR / LCP placeholder before WebGL hydrates. */
export function HeroIpadFallback({ locale: _locale }: HeroIpadFallbackProps) {
  return (
    <div className="hero-ipad-fallback relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="absolute -inset-4 rounded-[2rem] bg-primary/5 blur-2xl" aria-hidden />
      <div className="relative rounded-[1.75rem] border border-border/70 bg-muted/30 p-3 shadow-lg">
        <div className="rounded-[1.25rem] border border-border/60 bg-card overflow-hidden">
          <HeroProductPreview />
        </div>
      </div>
    </div>
  );
}
