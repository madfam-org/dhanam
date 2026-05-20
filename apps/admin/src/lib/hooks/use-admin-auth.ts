import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { apiClient } from '../api/client';

interface AdminAuthState {
  user: {
    id: string;
    email: string;
    name: string;
    isAdmin?: boolean;
    spaces?: Array<{ id: string; role: string }>;
  } | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  _hasHydrated: boolean;

  setHasHydrated: (state: boolean) => void;
  logout: () => void;
}

function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || typeof globalThis.atob !== 'function') return null;

  const [, rawPayload] = token.split('.');
  if (!rawPayload) return null;

  try {
    const base64 = rawPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function hasPlatformAdminAccess(
  user: AdminAuthState['user'],
  token: string | null
): boolean {
  if (user?.isAdmin === true) return true;

  const tokenPayload = decodeJwtPayload(token);
  return tokenPayload?.is_admin === true || tokenPayload?.isAdmin === true;
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isAdmin: false,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      logout: () => {
        apiClient.clearTokens();
        set({ user: null, token: null, isAuthenticated: false, isAdmin: false });
        if (typeof document !== 'undefined') {
          const isProduction = window.location.hostname.endsWith('.dhan.am');
          const domainAttr = isProduction ? ' Domain=.dhan.am;' : '';
          document.cookie = `auth-storage=; path=/;${domainAttr} max-age=0; SameSite=Lax`;
        }
        window.location.href = '/login';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
      }),
      onRehydrateStorage: () => (state) => {
        try {
          if (state?.token) {
            apiClient.setTokens({ accessToken: state.token });
            useAdminAuth.setState({ isAdmin: hasPlatformAdminAccess(state.user, state.token) });
          }
        } catch (error) {
          console.error('[useAdminAuth] Rehydration error:', error);
        } finally {
          useAdminAuth.getState().setHasHydrated(true);
        }
      },
    }
  )
);

if (typeof window !== 'undefined') {
  const scheduleHydrationCheck = () => {
    const state = useAdminAuth.getState();
    if (!state._hasHydrated) {
      state.setHasHydrated(true);
    }
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(scheduleHydrationCheck, { timeout: 1000 });
  } else {
    setTimeout(scheduleHydrationCheck, 500);
  }
}
