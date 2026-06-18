'use client';

import type { AuthTokens, ShowcasePersona, UserProfile } from '@dhanam/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { authApi } from '~/lib/api/auth';
import { setDemoModeCookie } from '~/lib/demo/session-cookies';
import { useAuth } from '~/lib/hooks/use-auth';
import { useSpaceStore } from '~/stores/space';

import { useShowcaseLocaleSync } from './use-showcase-locale-sync';

const VALID_PERSONAS: ShowcasePersona[] = ['maria', 'patricia'];

function normalizePersona(value: string | null): ShowcasePersona {
  if (value && VALID_PERSONAS.includes(value as ShowcasePersona)) {
    return value as ShowcasePersona;
  }
  return 'maria';
}

function personaFromEmail(email: string | undefined): string | null {
  if (!email) {
    return null;
  }
  const local = email.split('@')[0];
  return local ?? null;
}

async function applyPersonaSession(
  persona: ShowcasePersona,
  setAuth: (user: UserProfile, tokens: AuthTokens) => void,
  queryClient: ReturnType<typeof useQueryClient>,
  isAuthenticated: boolean,
  currentPersona: string | null
) {
  const result =
    isAuthenticated && currentPersona
      ? await authApi.switchPersona(persona)
      : await authApi.loginAsPersona(persona);

  setAuth(result.user as UserProfile, result.tokens);
  useSpaceStore.getState().setCurrentSpace(null);
  useSpaceStore.getState().setSpaces([]);
  queryClient.clear();
  setDemoModeCookie();
}

export function EmbedBootstrap() {
  const searchParams = useSearchParams();
  const { isAuthenticated, user, setAuth } = useAuth();
  const queryClient = useQueryClient();
  const bootstrappedRef = useRef(false);
  const bootstrappingRef = useRef(false);
  const showcase = searchParams.get('showcase') === '1';

  useShowcaseLocaleSync(showcase);

  useEffect(() => {
    const persona = normalizePersona(searchParams.get('persona'));
    if (!showcase) {
      return;
    }

    const currentPersona = personaFromEmail(user?.email);
    if (isAuthenticated && currentPersona === persona) {
      bootstrappedRef.current = true;
      return;
    }

    if (bootstrappedRef.current || bootstrappingRef.current) {
      return;
    }

    bootstrappingRef.current = true;

    void (async () => {
      try {
        await applyPersonaSession(persona, setAuth, queryClient, isAuthenticated, currentPersona);
        bootstrappedRef.current = true;
      } catch (error) {
        console.error('Embed showcase bootstrap failed:', error);
        // Fail closed — never reset bootstrappedRef or the effect will retry and amplify 429s.
        bootstrappedRef.current = true;
      } finally {
        bootstrappingRef.current = false;
      }
    })();
  }, [isAuthenticated, queryClient, searchParams, setAuth, showcase, user?.email]);

  return null;
}
