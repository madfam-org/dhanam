'use client';

import { Alert, AlertDescription, Button } from '@dhanam/ui';
import { JanuaProvider } from '@janua/react-sdk';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Component, type ReactNode } from 'react';

import { AdminAuthShell } from '@/components/auth/admin-auth-shell';
import { AdminJanuaSignIn } from '@/components/auth/admin-janua-sign-in';
import { useAdminAuth } from '@/lib/hooks/use-admin-auth';

const januaConfig = {
  baseURL: process.env.NEXT_PUBLIC_OIDC_ISSUER || 'https://auth.madfam.io',
  clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'dhanam-admin',
  debug: process.env.NODE_ENV !== 'production',
};

/** Catches errors from Janua SDK components without crashing the page */
class JanuaErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-3">
              <p>SSO sign-in is temporarily unavailable.</p>
              <Button variant="default" asChild>
                <Link href="https://auth.madfam.io">Sign in with Janua SSO</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )
      );
    }
    return this.props.children;
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isAdmin, _hasHydrated } = useAdminAuth();

  const redirectTo = searchParams.get('from') || '/dashboard';

  useEffect(() => {
    if (!_hasHydrated) return;
    if (isAuthenticated && isAdmin) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isAdmin, _hasHydrated, router, redirectTo]);

  const handleSignInSuccess = () => {
    router.replace(redirectTo);
  };

  if (!_hasHydrated) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-8 shadow-sm"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-center text-sm text-muted-foreground">Checking session…</p>
      </div>
    );
  }

  if (isAuthenticated && isAdmin) {
    return (
      <div
        className="rounded-lg border border-border bg-card p-8 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <p className="text-center text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return (
    <JanuaErrorBoundary>
      <h2 id="admin-login-heading" className="sr-only">
        Operator sign in
      </h2>
      <AdminJanuaSignIn redirectTo={redirectTo} onSuccess={handleSignInSuccess} />
    </JanuaErrorBoundary>
  );
}

export default function AdminLoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <AdminAuthShell loading={!mounted}>
      {mounted ? (
        <JanuaProvider config={januaConfig}>
          <LoginForm />
        </JanuaProvider>
      ) : null}
    </AdminAuthShell>
  );
}
