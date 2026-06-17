'use client';

import type { ShowcasePersona } from '@dhanam/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { authApi } from '~/lib/api/auth';
import { setDemoModeCookie } from '~/lib/demo/session-cookies';
import { useAuth } from '~/lib/hooks/use-auth';
import { useSpaceStore } from '~/stores/space';

const VALID_PERSONAS: ShowcasePersona[] = ['maria', 'patricia'];

function normalizePersona(value: string | null): ShowcasePersona {
  if (value && VALID_PERSONAS.includes(value as ShowcasePersona)) {
    return value as ShowcasePersona;
  }
  return 'maria';
}

export function EmbedBootstrap() {
  const searchParams = useSearchParams();
  const { isAuthenticated, user, setAuth } = useAuth();
  const queryClient = useQueryClient();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    const persona = normalizePersona(searchParams.get('persona'));
    const showcase = searchParams.get('showcase') === '1';
    if (!showcase) {
      return;
    }

    const currentPersona = user?.email?.split('@')[0];
    if (isAuthenticated && currentPersona === persona) {
      bootstrappedRef.current = true;
      return;
    }

    bootstrappedRef.current = true;

    void (async () => {
      try {
        const result = await authApi.loginAsPersona(persona);
        setAuth(result.user as Parameters<typeof setAuth>[0], result.tokens);
        useSpaceStore.getState().setCurrentSpace(null);
        useSpaceStore.getState().setSpaces([]);
        queryClient.clear();
        setDemoModeCookie();
      } catch (error) {
        console.error('Embed showcase bootstrap failed:', error);
        bootstrappedRef.current = false;
      }
    })();
  }, [isAuthenticated, queryClient, searchParams, setAuth, user?.email]);

  return null;
}
