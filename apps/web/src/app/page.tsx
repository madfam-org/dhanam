'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button } from '@dhanam/ui';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useTranslation } from '@dhanam/shared';
import { Globe } from 'lucide-react';
import { toast } from 'sonner';

import { Hero } from '@/components/landing/hero';
import { ProblemSolution } from '@/components/landing/problem-solution';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { SocialProof } from '@/components/landing/social-proof';
import { Pricing } from '@/components/landing/pricing';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';

function HomePageContent() {
  const { isAuthenticated } = useAuth();
  const analytics = useAnalytics();
  const { t } = useTranslation('landing');

  const appUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!appUrl && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('NEXT_PUBLIC_BASE_URL is missing in non-development environment');
  }

  const resolvedAppUrl = appUrl || 'https://app.dhan.am';

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = `${resolvedAppUrl}/dashboard`;
    } else {
      analytics.trackPageView('Landing Page', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: analytics is stable; only re-run when auth state changes
  }, [isAuthenticated]);

  const handleLiveDemoClick = async () => {
    analytics.track('live_demo_clicked', { source: 'hero_cta' });

    const geoCookie =
      typeof document !== 'undefined'
        ? document.cookie
            .split('; ')
            .find((c) => c.startsWith('dhanam_geo='))
            ?.split('=')[1]
        : undefined;

    try {
      const { authApi } = await import('@/lib/api/auth');
      const { useAuth } = await import('@/lib/hooks/use-auth');

      const response = await authApi.loginAsGuest({ countryCode: geoCookie });
      useAuth.getState().setAuth(response.user, response.tokens);

      analytics.track('demo_session_started', {
        userId: response.user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      window.location.href = `${resolvedAppUrl}/dashboard`;
    } catch (error) {
      console.error('Guest login failed:', error);
      toast.error('Failed to access demo session. Redirecting to demo menu.');
      analytics.track('demo_session_failed', { error: String(error) });
      window.location.href = `${resolvedAppUrl}/demo`;
    }
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
