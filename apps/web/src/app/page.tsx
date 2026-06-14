'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { Globe } from 'lucide-react';
import { useEffect } from 'react';

import { FeaturesGrid } from '@/components/landing/features-grid';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Pricing } from '@/components/landing/pricing';
import { ProblemSolution } from '@/components/landing/problem-solution';
import { SocialProof } from '@/components/landing/social-proof';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { redirectToAppDemo } from '@/lib/demo/launch-demo';
import { useAuth } from '@/lib/hooks/use-auth';

function HomePageContent() {
  const { isAuthenticated } = useAuth();
  const analytics = useAnalytics();
  const { t } = useTranslation('landing');

  const appUrl = usePublicAppUrl();
  const resolvedAppUrl = appUrl || 'https://app.dhan.am';

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = `${resolvedAppUrl}/dashboard`;
    } else {
      analytics.trackPageView('Landing Page', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: analytics is stable; only re-run when auth state changes
  }, [isAuthenticated]);

  const handleLiveDemoClick = () => {
    analytics.track('live_demo_clicked', { source: 'hero_cta' });
    // No forced persona — land on the picker so the visitor chooses their path.
    redirectToAppDemo(resolvedAppUrl);
  };

  const handleSignUpClick = (plan?: string) => {
    analytics.track('signup_clicked', { source: 'landing_cta', plan });
    const planParam = plan ? `?plan=${plan}` : '';
    window.location.href = `${resolvedAppUrl}/register${planParam}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Dhanam</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href={`${resolvedAppUrl}/login`}>
              <Button variant="ghost">{t('nav.login')}</Button>
            </a>
            <a href={`${resolvedAppUrl}/register`}>
              <Button>{t('nav.getStarted')}</Button>
            </a>
          </div>
        </div>
      </nav>

      <Hero onLiveDemoClick={handleLiveDemoClick} onSignUpClick={handleSignUpClick} />
      <ProblemSolution />
      <HowItWorks />
      <FeaturesGrid />
      <SocialProof />
      <Pricing onSignUpClick={handleSignUpClick} />
      <FinalCta onLiveDemoClick={handleLiveDemoClick} onSignUpClick={handleSignUpClick} />
      <Footer />
    </div>
  );
}

export default function HomePage() {
  return <HomePageContent />;
}
