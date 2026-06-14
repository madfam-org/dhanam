'use client';

import { Button } from '@dhanam/ui';
import { Globe } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Footer } from '@/components/landing/footer';
import { Pricing } from '@/components/landing/pricing';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { useAuth } from '@/lib/hooks/use-auth';

/**
 * Public, deep-linkable pricing funnel entry (for ads / sales / SEO).
 * Reuses the catalog-driven <Pricing> section and the plan-aware register
 * handoff so the checkout funnel is consistent with the landing page.
 */
export default function PricingPage() {
  const { isAuthenticated } = useAuth();
  const analytics = useAnalytics();

  const appUrl = usePublicAppUrl();
  const resolvedAppUrl = appUrl || 'https://app.dhan.am';

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = `${resolvedAppUrl}/billing/upgrade`;
    } else {
      analytics.trackPageView('Pricing Page', '/pricing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- analytics is stable; only re-run on auth change
  }, [isAuthenticated]);

  const handleSignUpClick = (plan?: string) => {
    analytics.track('signup_clicked', { source: 'pricing_page', plan });
    const planParam = plan ? `?plan=${plan}` : '';
    window.location.href = `${resolvedAppUrl}/register${planParam}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <nav className="container mx-auto px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Globe className="h-6 w-6 text-primary" />
            <span className="text-2xl font-bold">Dhanam</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href={`${resolvedAppUrl}/login`}>
              <Button variant="ghost">Log in</Button>
            </a>
            <a href={`${resolvedAppUrl}/register`}>
              <Button>Get started</Button>
            </a>
          </div>
        </div>
      </nav>

      <header className="container mx-auto px-6 pt-16 pb-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Plans that grow with your wealth</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Start free. Upgrade when you need household views, deeper projections, and priority
          support. Cancel anytime.
        </p>
      </header>

      <Pricing onSignUpClick={handleSignUpClick} />
      <Footer />
    </div>
  );
}
