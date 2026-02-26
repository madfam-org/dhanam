'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '~/components/layout/dashboard-nav';
import { DashboardHeader } from '~/components/layout/dashboard-header';
import { DemoModeBanner } from '~/components/demo/demo-mode-banner';
import { SubscriptionBanner } from '~/components/billing/SubscriptionBanner';
import { DemoTour } from '~/components/demo/demo-tour';
import { KeyboardShortcuts } from '~/components/keyboard-shortcuts';
import { PageTransition } from '~/components/motion/page-transition';
import { DemoNavigationProvider } from '~/lib/contexts/demo-navigation-context';
import { useAuth } from '~/lib/hooks/use-auth';
import { authApi } from '~/lib/api/auth';

/**
 * Loading skeleton shown during SSR and initial client hydration.
 * Must match on both server and client to prevent hydration mismatch.
 */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b bg-card animate-pulse" />
      <div className="flex">
        <div className="w-64 border-r bg-card animate-pulse hidden md:block" />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-7xl">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-4" />
            <div className="h-64 bg-muted rounded animate-pulse" />
          </div>
        </main>
      </div>
    </div>
  );
}

function isDemoModeCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.includes('demo-mode=true');
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hasHydrated, user, refreshUser, setAuth } = useAuth();
  const router = useRouter();
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
        <DashboardHeader />
        <SubscriptionBanner />
        <DemoModeBanner />
        <DemoTour />
        <KeyboardShortcuts />
        <div className="flex">
          <DashboardNav />
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-7xl">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
    </DemoNavigationProvider>
  );
}
