'use client';

import { useTranslation } from '@dhanam/shared';
import { useAuth as useJanuaAuth } from '@janua/react-sdk'; // OK: this page only renders client-side via Suspense
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
// Dynamic import to avoid SSR crash (useJanua requires JanuaProvider)

/**
 * Loading spinner shown while the SDK processes the PKCE callback.
 */
function CallbackLoading() {
  const { t } = useTranslation('auth');
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <h2 className="text-xl font-semibold">{t('completingSignIn')}</h2>
        <p className="text-muted-foreground mt-2">{t('verifyingCredentials')}</p>
      </div>
    </div>
  );
}

/**
 * Callback content — the SDK's JanuaProvider handles the ?code= exchange
 * automatically. This page just shows status and redirects.
 */
function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('auth');
  const { isSignedIn, isLoaded } = useJanuaAuth();

  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const redirectTo = searchParams.get('state') || '/dashboard';

  // Handle OAuth error from Janua
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`);
    }, 2000);
    return () => clearTimeout(timer);
  }, [error, errorDescription, router]);

  // Redirect once SDK finishes authentication
  useEffect(() => {
    if (isLoaded && isSignedIn && !error) {
      router.push(redirectTo);
    }
  }, [isLoaded, isSignedIn, error, redirectTo, router]);

  return error ? (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 mx-auto rounded-full bg-red-100 flex items-center justify-center">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-red-600">{t('signInFailed')}</h2>
        <p className="text-muted-foreground mt-2">{errorDescription || error}</p>
        <p className="text-sm text-muted-foreground mt-1">{t('redirectingToLogin')}</p>
      </div>
    </div>
  ) : (
    <CallbackLoading />
  );
}

/**
 * Janua SSO Callback Page
 *
 * The SDK's JanuaProvider intercepts the ?code= param and exchanges it
 * for tokens via PKCE automatically. This page shows a spinner and
 * redirects once authentication completes.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <CallbackContent />
    </Suspense>
  );
}
