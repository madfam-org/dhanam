'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { Globe, Menu, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FeaturesGrid } from '@/components/landing/features-grid';
import { FinalCta } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { PersonaCards } from '@/components/landing/persona-cards';
import { PlatformDepth } from '@/components/landing/platform-depth';
import { Pricing } from '@/components/landing/pricing';
import { ProblemSolution } from '@/components/landing/problem-solution';
import { SecurityTrust } from '@/components/landing/security-trust';
import { SocialProof } from '@/components/landing/social-proof';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/hooks/use-auth';

export default function LocaleLandingPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale as 'en' | 'es' | 'pt-BR';
  const { isAuthenticated } = useAuth();
  const analytics = useAnalytics();
  const { t } = useTranslation('landing');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.dhan.am';

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = `${appUrl}/dashboard`;
    } else {
      analytics.trackPageView('Landing Page', `/${locale}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: analytics is stable; only re-run when auth state changes
  }, [isAuthenticated]);

  const handleLiveDemoClick = async () => {
    analytics.track('live_demo_clicked', { source: 'hero_cta', locale });

    // Read geo cookie for demo defaults
    const geoCookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('dhanam_geo='))
      ?.split('=')[1];

    try {
      const { authApi } = await import('@/lib/api/auth');
      const { useAuth } = await import('@/lib/hooks/use-auth');

      const response = await authApi.loginAsGuest({ countryCode: geoCookie });
      useAuth.getState().setAuth(response.user, response.tokens);

      analytics.track('demo_session_started', {
        userId: response.user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        countryCode: geoCookie,
      });

      window.location.href = `${appUrl}/dashboard`;
    } catch (error) {
      console.error('Guest login failed:', error);
      analytics.track('demo_session_failed', { error: String(error) });
      window.location.href = `${appUrl}/demo`;
    }
  };

  const handleSignUpClick = (plan?: string) => {
    analytics.track('signup_clicked', { source: 'landing_cta', locale, plan });
    const planParam = plan ? `?plan=${plan}` : '';
    window.location.href = `${appUrl}/register${planParam}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* SEO hreflang tags */}
      {}
      <head>
        <link rel="alternate" hrefLang="es" href="https://dhan.am/es" />
        <link rel="alternate" hrefLang="en" href="https://dhan.am/en" />
        <link rel="alternate" hrefLang="pt-BR" href="https://dhan.am/pt-BR" />
        <link rel="alternate" hrefLang="x-default" href="https://dhan.am/es" />
        <meta
          property="og:locale"
          content={locale === 'en' ? 'en_US' : locale === 'pt-BR' ? 'pt_BR' : 'es_MX'}
        />
        <meta property="og:locale:alternate" content="en_US" />
        <meta property="og:locale:alternate" content="es_MX" />
        <meta property="og:locale:alternate" content="pt_BR" />
      </head>

      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold">Dhanam</span>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1 text-sm">
              {(['es', 'en', 'pt-BR'] as const).map((l) => (
                <a
                  key={l}
                  href={`/${l}`}
                  className={`px-2 py-1 rounded ${l === locale ? 'bg-primary/10 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {l === 'es' ? 'ES' : l === 'en' ? 'EN' : 'PT'}
                </a>
              ))}
            </div>
            <a href={`${appUrl}/login`}>
              <Button variant="ghost">{t('nav.login')}</Button>
            </a>
            <a href={`${appUrl}/register`}>
              <Button>{t('nav.getStarted')}</Button>
            </a>
          </div>
          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 flex flex-col gap-3 border-t pt-4">
            <div className="flex items-center gap-1 text-sm">
              {(['es', 'en', 'pt-BR'] as const).map((l) => (
                <a
                  key={l}
                  href={`/${l}`}
                  className={`px-2 py-1 rounded ${l === locale ? 'bg-primary/10 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {l === 'es' ? 'ES' : l === 'en' ? 'EN' : 'PT'}
                </a>
              ))}
            </div>
            <a href={`${appUrl}/login`} className="w-full">
              <Button variant="ghost" className="w-full justify-start">
                {t('nav.login')}
              </Button>
            </a>
            <a href={`${appUrl}/register`} className="w-full">
              <Button className="w-full">{t('nav.getStarted')}</Button>
            </a>
          </div>
        )}
      </nav>

      <Hero onLiveDemoClick={handleLiveDemoClick} onSignUpClick={handleSignUpClick} />
      <PersonaCards />
      <ProblemSolution />
      <HowItWorks />
      <SecurityTrust />
      <FeaturesGrid />
      <PlatformDepth />
      <SocialProof />
      <Pricing onSignUpClick={handleSignUpClick} />
      <FinalCta onLiveDemoClick={handleLiveDemoClick} onSignUpClick={handleSignUpClick} />
      <Footer />
    </div>
  );
}
