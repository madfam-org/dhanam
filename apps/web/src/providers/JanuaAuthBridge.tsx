'use client';

import { useEffect, useCallback } from 'react';
import { JanuaProvider, useJanua, type JanuaConfig } from '@janua/react-sdk';
import { useAuth } from '~/lib/hooks/use-auth';
import type { UserProfile, AuthTokens, Locale } from '@dhanam/shared';

const januaConfig: JanuaConfig = {
  baseURL: process.env.NEXT_PUBLIC_JANUA_API_URL || 'http://localhost:3001',
  debug: process.env.NODE_ENV !== 'production',
};

/**
 * JanuaAuthSync - Syncs Janua SSO state with Dhanam's existing auth store
 *
 * This component bridges Janua's centralized identity system with Dhanam's
 * local auth state management, enabling SSO while preserving existing auth hooks.
 */
function JanuaAuthSync({ children }: { children: React.ReactNode }) {
  const {
    user: januaUser,
    isAuthenticated: januaAuthenticated,
    isLoading: januaLoading,
  } = useJanua();
  const { setAuth, clearAuth, isAuthenticated: dhanamAuthenticated, _hasHydrated } = useAuth();

  const syncAuthState = useCallback(() => {
    // Don't make any auth decisions while Janua is still loading
    // This prevents race conditions where we'd clear auth before Janua validates the token
    if (januaLoading) {
      return;
    }

    // CRITICAL: Wait for Zustand hydration before modifying auth state
    // This prevents clearAuth() from interfering with the hydration process
    if (!_hasHydrated) {
      return;
    }

    if (januaAuthenticated && januaUser) {
      // Map Janua locale to Dhanam Locale ('en' | 'es')
      const mapLocale = (januaLocale?: string): Locale => {
        if (januaLocale?.startsWith('es')) return 'es';
        return 'en';
      };

      // Map Janua user (snake_case) to Dhanam UserProfile (camelCase)
      const dhanamUser: UserProfile = {
        id: januaUser.id,
        email: januaUser.email,
        name: januaUser.name || januaUser.display_name || januaUser.email.split('@')[0] || 'User',
        locale: mapLocale(januaUser.locale),
        timezone: januaUser.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        totpEnabled: januaUser.mfa_enabled || false,
        emailVerified: januaUser.email_verified || false,
        onboardingCompleted: true, // Assume completed if coming from SSO
        createdAt: januaUser.created_at || new Date().toISOString(),
        updatedAt: januaUser.updated_at || new Date().toISOString(),
        // Dhanam-specific: default personal space for SSO users
        spaces: [
          {
            id: `personal-${januaUser.id}`,
            name: 'Personal',
            type: 'personal',
            role: 'owner',
          },
        ],
      };

      // Create tokens from Janua session
      const tokens: AuthTokens = {
        accessToken: localStorage.getItem('janua_access_token') || `janua_session_${januaUser.id}`,
        refreshToken:
          localStorage.getItem('janua_refresh_token') || `janua_refresh_${januaUser.id}`,
        expiresIn: 15 * 60, // 15 minutes in seconds
      };

      setAuth(dhanamUser, tokens);
    } else if (!januaAuthenticated && dhanamAuthenticated) {
      // Janua finished loading and says not authenticated, but Dhanam thinks we are
      // This means either: Janua logged out, or token was invalid
      // Clear Dhanam auth to stay in sync
      clearAuth();
    }
  }, [
    januaLoading,
    januaAuthenticated,
    januaUser,
    dhanamAuthenticated,
    setAuth,
    clearAuth,
    _hasHydrated,
  ]);

  useEffect(() => {
    syncAuthState();
  }, [syncAuthState]);

  return <>{children}</>;
}

interface JanuaAuthBridgeProps {
  children: React.ReactNode;
}

/**
 * JanuaAuthBridge Provider
 *
 * Wraps JanuaProvider and syncs its auth state with Dhanam's local auth.
 * Place this OUTSIDE of Dhanam's AuthProvider in the provider hierarchy.
 */
export function JanuaAuthBridge({ children }: JanuaAuthBridgeProps) {
  return (
    <JanuaProvider config={januaConfig}>
      <JanuaAuthSync>{children}</JanuaAuthSync>
    </JanuaProvider>
  );
}

// Re-export Janua hooks for direct usage if needed
export { useJanua };
