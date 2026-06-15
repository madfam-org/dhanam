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
import { PressStrip } from '@/components/landing/press-strip';
import { Pricing } from '@/components/landing/pricing';
import { ProblemSolution } from '@/components/landing/problem-solution';
import { ProductStorySection } from '@/components/landing/product-story-section';
import { SecurityTrust } from '@/components/landing/security-trust';
import { SocialProof } from '@/components/landing/social-proof';
import { StatsBar } from '@/components/landing/stats-bar';
import { TestimonialCarousel } from '@/components/landing/testimonial-carousel';
import { useLandingAnalytics } from '@/hooks/use-landing-analytics';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { redirectToAppDemo } from '@/lib/demo/launch-demo';
import { useAuth } from '@/lib/hooks/use-auth';

export interface LandingPageClientProps {
  locale: LandingLocale;
  /** Server-rendered hero copy + trust strip */
  heroColumn: React.ReactNode;
  /** Server-rendered product preview frame */
  heroPreview: React.ReactNode;
  /** Server-rendered capability badges below hero */
  heroCapabilities: React.ReactNode;
}

export function LandingPageClient({
  locale,
  heroColumn,
  heroPreview,
  heroCapabilities,
}: LandingPageClientProps) {
  const { isAuthenticated } = useAuth();
  const analytics = useAnalytics();
  useLandingAnalytics(locale, analytics);

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
        <section
          className="container mx-auto px-6 py-16 md:py-24"
          aria-labelledby="landing-hero"
          data-landing-section="hero"
        >
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="order-2 lg:order-1 space-y-2">
              {heroColumn}
              <LandingHeroActions
                onLiveDemoClick={() => handleLiveDemoClick('hero_cta')}
                onSignUpClick={() => handleSignUpClick(undefined, 'hero_cta')}
              />
            </div>
            <div className="order-1 lg:order-2">{heroPreview}</div>
          </div>
          {heroCapabilities}
        </section>

        <div id="personas" data-landing-section="personas">
          <PersonaCards locale={locale} />
        </div>
        <div data-landing-section="product_story">
          <ProductStorySection />
        </div>
        <div data-landing-section="problem_solution">
          <ProblemSolution />
        </div>
        <div data-landing-section="how_it_works">
          <HowItWorks />
        </div>
        <div data-landing-section="stats">
          <StatsBar />
        </div>
        <div data-landing-section="testimonials">
          <TestimonialCarousel />
        </div>
        <div data-landing-section="press">
          <PressStrip />
        </div>
        <div data-landing-section="security">
          <SecurityTrust />
        </div>
        <div data-landing-section="features">
          <FeaturesGrid />
        </div>
        <div data-landing-section="platform">
          <PlatformDepth />
        </div>
        <div data-landing-section="social_proof">
          <SocialProof />
        </div>
        <div id="pricing" data-landing-section="pricing">
          <Pricing onSignUpClick={(plan) => handleSignUpClick(plan, 'pricing_cta')} />
        </div>
        <div data-landing-section="final_cta">
          <FinalCta
            onLiveDemoClick={() => handleLiveDemoClick('final_cta')}
            onSignUpClick={() => handleSignUpClick(undefined, 'final_cta')}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
