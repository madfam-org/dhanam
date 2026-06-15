'use client';

import type { LandingLocale } from '@dhanam/shared';
import { useEffect } from 'react';

import { FeaturesGrid } from '@/components/landing/features-grid';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingHeroActions } from '@/components/landing/landing-hero-actions';
import { LandingNav } from '@/components/landing/landing-nav';
import { PersonaCards } from '@/components/landing/persona-cards';
import { PlatformDepth } from '@/components/landing/platform-depth';
import { Pricing } from '@/components/landing/pricing';
import { ProblemSolution } from '@/components/landing/problem-solution';
import { SecurityTrust } from '@/components/landing/security-trust';
import { SocialProof } from '@/components/landing/social-proof';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { redirectToAppDemo } from '@/lib/demo/launch-demo';
import { useAuth } from '@/lib/hooks/use-auth';

export interface LandingPageClientProps {
  locale: LandingLocale;
  /** Server-rendered hero copy (badge, H1, subtitles) — composed via RSC slot pattern */
  heroStatic: React.ReactNode;
  /** Server-rendered capability badges below hero actions */
  heroCapabilities: React.ReactNode;
}

export function LandingPageClient({
  locale,
  heroStatic,
  heroCapabilities,
}: LandingPageClientProps) {
  const { isAuthenticated } = useAuth();
  const analytics = useAnalytics();

  const appUrl = usePublicAppUrl();
  const resolvedAppUrl = appUrl || 'https://app.dhan.am';
  const pagePath = `/${locale}`;

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = `${resolvedAppUrl}/dashboard`;
    } else {
      analytics.trackPageView('Landing Page', pagePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analytics stable; auth-only deps
  }, [isAuthenticated, pagePath, resolvedAppUrl]);

  const handleLiveDemoClick = (source: string) => {
    analytics.track('live_demo_clicked', { source, locale });
    redirectToAppDemo(resolvedAppUrl);
  };

  const handleSignUpClick = (plan?: string, source = 'landing_cta') => {
    analytics.track('signup_clicked', { source, locale, plan });
    const planParam = plan ? `?plan=${plan}` : '';
    window.location.href = `${resolvedAppUrl}/register${planParam}`;
  };

  return (
    <div className="landing-root min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <LandingNav locale={locale} />

      <main id="main-content">
        <section className="container mx-auto px-6 py-16 md:py-24" aria-labelledby="landing-hero">
          {heroStatic}
          <LandingHeroActions
            onLiveDemoClick={() => handleLiveDemoClick('hero_cta')}
            onSignUpClick={() => handleSignUpClick(undefined, 'hero_cta')}
          />
          {heroCapabilities}
        </section>

        <PersonaCards />
        <ProblemSolution />
        <HowItWorks />
        <SecurityTrust />
        <FeaturesGrid />
        <PlatformDepth />
        <SocialProof />
        <Pricing onSignUpClick={(plan) => handleSignUpClick(plan, 'pricing_cta')} />
        <FinalCta
          onLiveDemoClick={() => handleLiveDemoClick('final_cta')}
          onSignUpClick={() => handleSignUpClick(undefined, 'final_cta')}
        />
      </main>

      <Footer />
    </div>
  );
}
