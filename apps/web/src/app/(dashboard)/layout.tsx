'use client';

import { useTranslation } from '@dhanam/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { SubscriptionBanner } from '~/components/billing/SubscriptionBanner';
import { DemoModeBanner } from '~/components/demo/demo-mode-banner';
import { DemoTour } from '~/components/demo/demo-tour';
import { KeyboardShortcuts } from '~/components/keyboard-shortcuts';
import { DashboardHeader } from '~/components/layout/dashboard-header';
import { DashboardNav } from '~/components/layout/dashboard-nav';
import { MobileNav } from '~/components/layout/mobile-nav';
import { PageTransition } from '~/components/motion/page-transition';
import { authApi } from '~/lib/api/auth';
import { DemoNavigationProvider } from '~/lib/contexts/demo-navigation-context';
import { useAuth } from '~/lib/hooks/use-auth';
import { useSpaces } from '~/lib/hooks/use-spaces';

/**
 * Loading skeleton shown during SSR and initial client hydration.
 * Must match on both server and client to prevent hydration mismatch.
 */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="h-16 border-b bg-card animate-pulse" />
      <div className="flex">
        <div className="w-64 border-r bg-card animate-pulse hidden md:block" />
        <main id="main-content" className="flex-1 p-6">
          <div className="mx-auto max-w-7xl">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-4" />
            <div className="h-64 bg-muted rounded animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
}

function SkipLink() {
  const { t } = useTranslation('common');
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
    >
      {t('aria.skipToContent')}
    </a>
  );
}

function isDemoModeCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('demo-mode=true');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user, refreshUser, setAuth } = useAuth();
  const router = useRouter();
  // Trigger spaces fetch early so child pages have data before rendering.
  // React Query deduplicates by key, so the header's useSpaces() won't double-fetch.
  useSpaces();
  // Track if client has hydrated - prevents SSR/client mismatch
  const [hasMounted, setHasMounted] = useState(false);
  const [demoAutoLoginInProgress, setDemoAutoLoginInProgress] = useState(false);

  // Mark as mounted after initial render (client-side only)
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Demo auto-auth: if demo-mode cookie is set but user not authenticated, auto-login as guest
  const attemptDemoLogin = useCallback(async () => {
    if (demoAutoLoginInProgress) return;
    setDemoAutoLoginInProgress(true);
    try {
      const result = await authApi.loginAsPersona('guest');
      setAuth(result.user as any, result.tokens);
    } catch (error) {
      console.error('Demo auto-login failed:', error);
    } finally {
      setDemoAutoLoginInProgress(false);
    }
  }, [demoAutoLoginInProgress, setAuth]);

  // Fetch user profile in background if we have tokens but no user data
  // This happens after SSO login where only tokens are stored
  // Non-blocking: don't wait for this to render the dashboard
  useEffect(() => {
    if (_hasHydrated && isAuthenticated && !user) {
      refreshUser().catch(console.error);
    }
  }, [_hasHydrated, isAuthenticated, user, refreshUser]);

  // Redirect unauthenticated users after Zustand hydration is complete
  // Skip redirect when in demo mode — auto-login will handle it
  useEffect(() => {
    if (hasMounted && _hasHydrated && !isAuthenticated) {
      if (isDemoModeCookie()) {
        attemptDemoLogin();
      } else {
        router.push('/login');
      }
    }
  }, [hasMounted, _hasHydrated, isAuthenticated, router, attemptDemoLogin]);

  // Show skeleton during SSR and initial hydration
  // This ensures server and client render the same content initially
  if (!hasMounted) {
    return <DashboardSkeleton />;
  }

  // Wait for Zustand to hydrate from localStorage before deciding
  if (!_hasHydrated) {
    return <DashboardSkeleton />;
  }

  // After hydration, if not authenticated, show skeleton while redirecting or auto-logging in
  if (!isAuthenticated) {
    return <DashboardSkeleton />;
  }

  return (
    <DemoNavigationProvider>
      <div className="min-h-screen bg-background">
        <SkipLink />
        <DashboardHeader />
        <SubscriptionBanner />
        <DemoModeBanner />
        <DemoTour />
        <KeyboardShortcuts />
        <div className="flex">
          <div className="hidden md:block">
            <DashboardNav />
          </div>
          <main id="main-content" className="flex-1 p-6 pb-20 md:pb-6">
            <div className="mx-auto max-w-7xl">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </DemoNavigationProvider>
  );
}
