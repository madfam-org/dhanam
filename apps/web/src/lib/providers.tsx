'use client';

import { I18nProvider } from '@dhanam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef, type ComponentType } from 'react';

import { AuthProvider } from '~/components/auth-provider';
import { CookieConsentBanner } from '~/components/cookie-consent-banner';
import { PmfWidgetMount } from '~/components/pmf/PmfWidgetMount';
import { ThemeProvider } from '~/components/theme-provider';
import { PreferencesProvider } from '~/contexts/PreferencesContext';
import PostHogProvider from '~/providers/PostHogProvider';

/**
 * SSR-safe wrapper: @janua/react-sdk accesses browser APIs at module level,
 * crashing SSR and collapsing the entire provider tree. This wrapper:
 * - SSR: renders children directly (no @janua/react-sdk loaded)
 * - Client: dynamically imports JanuaProvider + JanuaAuthSync after mount
 *
 * Replaces the former JanuaAuthBridge with a direct JanuaProvider wrapping
 * a lightweight sync component that pushes Janua SDK state into the
 * Dhanam useAuth() Zustand store.
 */
function SSRSafeJanuaProvider({ children }: { children: React.ReactNode }) {
  const [Wrapper, setWrapper] = useState<ComponentType<{ children: React.ReactNode }> | null>(null);

  useEffect(() => {
    Promise.all([import('@janua/react-sdk'), import('~/lib/hooks/use-auth')]).then(
      ([januaSdk, authModule]) => {
        const { JanuaProvider, useAuth: useJanuaAuth, useSession, useUser } = januaSdk;
        const { useAuth } = authModule;

        const januaConfig = {
          baseURL: process.env.NEXT_PUBLIC_JANUA_API_URL || 'http://localhost:3001',
          clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'dhanam-web',
          redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3040'}/auth/callback`,
          debug: process.env.NODE_ENV !== 'production',
        };

        /**
         * JanuaAuthSync — syncs Janua SDK state into Dhanam's useAuth() store.
         *
         * Replaces the former JanuaAuthBridge sync component. Runs inside
         * JanuaProvider so Janua hooks are available.
         */
        function JanuaAuthSync({ children: syncChildren }: { children: React.ReactNode }) {
          const { isSignedIn, isLoaded: authLoaded } = useJanuaAuth();
          const { session } = useSession();
          const { user: januaUser } = useUser();
          const { setAuth, clearAuth, isAuthenticated: dhanamAuthenticated } = useAuth();
          const verificationInFlight = useRef(false);

          const syncAuthState = useCallback(() => {
            if (!authLoaded) return;

            if (isSignedIn && januaUser) {
              const mapLocale = (januaLocale?: string): import('@dhanam/shared').Locale => {
                if (januaLocale?.startsWith('es')) return 'es';
                return 'en';
              };

              const dhanamUser: import('@dhanam/shared').UserProfile = {
                id: januaUser.id,
                email: januaUser.email,
                name:
                  januaUser.name ||
                  januaUser.display_name ||
                  januaUser.email.split('@')[0] ||
                  'User',
                locale: mapLocale(januaUser.locale),
                timezone: januaUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                totpEnabled: januaUser.mfa_enabled || false,
                emailVerified: januaUser.email_verified || false,
                onboardingCompleted: true,
                createdAt: januaUser.created_at || new Date().toISOString(),
                updatedAt: januaUser.updated_at || new Date().toISOString(),
                spaces: [],
              };

              const tokens: import('@dhanam/shared').AuthTokens = {
                accessToken: session?.accessToken || '',
                refreshToken: session?.refreshToken || '',
                expiresIn: session?.expiresAt
                  ? Math.floor((session.expiresAt - Date.now()) / 1000)
                  : 15 * 60,
              };

              setAuth(dhanamUser, tokens);

              // Set cookie for middleware auth check
              if (typeof document !== 'undefined') {
                document.cookie =
                  'auth-storage=authenticated; path=/; max-age=86400; SameSite=Lax; Secure';
              }
            } else if (!isSignedIn && !dhanamAuthenticated) {
              // SECURITY: This is an optimistic decode for UI hydration only.
              // The token is NOT trusted until verified by the API server.
              // All API calls go through apiClient which validates the JWT server-side.
              //
              // Flow:
              // 1. Decode JWT payload (unverified) for immediate UI display
              // 2. Optimistically set auth state so the UI doesn't flash
              // 3. Verify the token server-side via /users/me
              // 4. If verification fails, clear auth and purge the invalid token
              const januaToken =
                typeof window !== 'undefined' ? localStorage.getItem('janua_access_token') : null;

              if (januaToken && !verificationInFlight.current) {
                try {
                  const payloadStr = januaToken.split('.')[1];
                  if (!payloadStr) throw new Error('Invalid token');
                  const payload = JSON.parse(atob(payloadStr));

                  // Reject obviously expired tokens before even attempting verification
                  if (payload.exp && payload.exp * 1000 < Date.now()) {
                    throw new Error('Token expired');
                  }

                  const januaRefresh = localStorage.getItem('janua_refresh_token') || '';

                  // Optimistic UI hydration — display user info while verifying
                  const optimisticUser: import('@dhanam/shared').UserProfile = {
                    id: payload.sub,
                    email: payload.email || '',
                    name: payload.name || payload.email?.split('@')[0] || 'User',
                    locale: 'en',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    totpEnabled: false,
                    emailVerified: payload.email_verified || true,
                    onboardingCompleted: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    spaces: [],
                  };

                  const optimisticTokens: import('@dhanam/shared').AuthTokens = {
                    accessToken: januaToken,
                    refreshToken: januaRefresh,
                    expiresIn: payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 15 * 60,
                  };

                  // Set optimistic state for UI hydration (prevents auth flash)
                  setAuth(optimisticUser, optimisticTokens);

                  if (typeof document !== 'undefined') {
                    document.cookie =
                      'auth-storage=authenticated; path=/; max-age=86400; SameSite=Lax; Secure';
                  }

                  // SECURITY: Verify the token server-side. The Dhanam API /users/me
                  // endpoint validates the JWT signature via NestJS JwtAuthGuard.
                  // If the token is forged or revoked, this call returns 401 and
                  // we revoke the optimistic auth state.
                  verificationInFlight.current = true;
                  const dhanamApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.dhan.am/v1';

                  fetch(`${dhanamApiUrl}/users/me`, {
                    headers: { Authorization: `Bearer ${januaToken}` },
                  })
                    .then((res) => {
                      if (!res.ok) {
                        // Server rejected the token — revoke optimistic auth
                        clearAuth();
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem('janua_access_token');
                          localStorage.removeItem('janua_refresh_token');
                          localStorage.removeItem('dhanam_user_profile');
                        }
                        if (typeof document !== 'undefined') {
                          document.cookie =
                            'auth-storage=; path=/; max-age=0; SameSite=Lax; Secure';
                        }
                        return;
                      }
                      return res.json();
                    })
                    .then((data) => {
                      if (!data) return; // Already handled in the !res.ok branch
                      // Server confirmed the token. Update auth with the verified
                      // server profile (includes subscriptionTier, isAdmin, etc.)
                      const verifiedProfile: import('@dhanam/shared').UserProfile =
                        data.data || data;
                      setAuth(verifiedProfile, optimisticTokens);
                    })
                    .catch(() => {
                      // Network error during verification — keep optimistic state
                      // but do NOT escalate trust. The apiClient will re-verify
                      // on the next actual API call and handle 401 there.
                    })
                    .finally(() => {
                      verificationInFlight.current = false;
                    });
                } catch {
                  // Token decode failed or expired — remove the bad token
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('janua_access_token');
                    localStorage.removeItem('janua_refresh_token');
                  }
                }
              }
            } else if (!isSignedIn && dhanamAuthenticated) {
              // Only clear when Janua says "not signed in" AND there is no
              // out-of-band session (direct PKCE tokens or demo mode)
              const hasJanuaToken =
                typeof window !== 'undefined' && localStorage.getItem('janua_access_token');
              const isDemoMode =
                typeof document !== 'undefined' && document.cookie.includes('demo-mode=true');

              if (!hasJanuaToken && !isDemoMode) {
                clearAuth();
                if (typeof document !== 'undefined') {
                  document.cookie = 'auth-storage=; path=/; max-age=0; SameSite=Lax; Secure';
                }
              }
            }
          }, [authLoaded, isSignedIn, januaUser, session, dhanamAuthenticated, setAuth, clearAuth]);

          useEffect(() => {
            syncAuthState();
          }, [syncAuthState]);

          return <>{syncChildren}</>;
        }

        // Build the combined wrapper component
        function JanuaWrapper({ children: wrapperChildren }: { children: React.ReactNode }) {
          return (
            <JanuaProvider config={januaConfig}>
              <JanuaAuthSync>{wrapperChildren}</JanuaAuthSync>
            </JanuaProvider>
          );
        }

        setWrapper(() => JanuaWrapper);
      }
    );
  }, []);

  if (!Wrapper) {
    return <>{children}</>;
  }

  return <Wrapper>{children}</Wrapper>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>
            <SSRSafeJanuaProvider>
              <AuthProvider>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Reason: React 19 type incompatibility with PreferencesProvider children prop */}
                <PreferencesProvider>{children as any}</PreferencesProvider>
                <PmfWidgetMount />
              </AuthProvider>
            </SSRSafeJanuaProvider>
            <CookieConsentBanner />
          </PostHogProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
