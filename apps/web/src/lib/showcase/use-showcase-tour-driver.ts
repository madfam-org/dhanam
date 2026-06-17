'use client';

import type { ShowcasePersona } from '@dhanam/shared';
import {
  buildEmbedDemoUrl,
  getHeroTourForPersona,
  isShowcaseMessage,
  SHOWCASE_LOOP_BREAK_MS,
  SHOWCASE_MESSAGE_TYPE,
  SHOWCASE_PERSONA_SWITCH_MS,
  SHOWCASE_STEP_GAP_MS,
} from '@dhanam/shared';
import { useCallback, useEffect, useRef } from 'react';

import { useAnalytics } from '@/hooks/useAnalytics';

const PERSONA_ORDER: ShowcasePersona[] = ['maria', 'patricia'];

interface UseShowcaseTourDriverOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  appUrl: string;
  enabled: boolean;
  locale: string;
}

export function useShowcaseTourDriver({
  iframeRef,
  appUrl,
  enabled,
  locale,
}: UseShowcaseTourDriverOptions) {
  const analytics = useAnalytics();
  const readyRef = useRef(false);
  const runningRef = useRef(false);
  const cancelledRef = useRef(false);
  const personaRef = useRef<ShowcasePersona>('maria');

  const postCommand = useCallback(
    (action: string, payload: Record<string, unknown> = {}) => {
      const frame = iframeRef.current?.contentWindow;
      if (!frame) {
        return;
      }
      try {
        const targetOrigin = new URL(appUrl).origin;
        frame.postMessage({ type: SHOWCASE_MESSAGE_TYPE, action, ...payload }, targetOrigin);
      } catch {
        // ignore invalid app URL during tests
      }
    },
    [appUrl, iframeRef]
  );

  const reloadIframe = useCallback(
    (persona: ShowcasePersona) => {
      const iframe = iframeRef.current;
      if (!iframe) {
        return;
      }
      readyRef.current = false;
      personaRef.current = persona;
      iframe.src = buildEmbedDemoUrl(appUrl, { persona, path: '/dashboard' });
    },
    [appUrl, iframeRef]
  );

  const runTourLoop = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;

    let personaIndex = 0;

    while (!cancelledRef.current) {
      const persona = PERSONA_ORDER[personaIndex] ?? 'maria';
      if (personaRef.current !== persona) {
        reloadIframe(persona);
      }

      await waitUntilReady(readyRef, 25_000);
      if (cancelledRef.current) {
        break;
      }

      const tour = getHeroTourForPersona(persona);
      for (const step of tour.steps) {
        if (cancelledRef.current) {
          break;
        }

        postCommand('navigate', { path: step.path });
        await sleep(SHOWCASE_STEP_GAP_MS + 500);

        if (step.scrollY !== undefined) {
          postCommand('scroll', { y: step.scrollY, behavior: 'smooth' });
          await sleep(400);
        }

        if (step.highlightTarget) {
          postCommand('highlight', { target: step.highlightTarget, durationMs: step.dwellMs });
        }

        if (step.cursorPoints && step.cursorPoints.length > 0) {
          postCommand('cursor', {
            points: step.cursorPoints,
            durationMs: Math.min(step.dwellMs, 2800),
          });
        }

        analytics.track('showcase_tour_step', {
          stepId: step.id,
          persona,
          locale,
          path: step.path,
        });

        await sleep(step.dwellMs);
      }

      if (cancelledRef.current) {
        break;
      }

      analytics.track('showcase_tour_completed', { persona, locale });
      await sleep(SHOWCASE_LOOP_BREAK_MS);

      personaIndex = (personaIndex + 1) % PERSONA_ORDER.length;
      const nextPersona = PERSONA_ORDER[personaIndex] ?? 'maria';
      await sleep(SHOWCASE_PERSONA_SWITCH_MS);
      reloadIframe(nextPersona);
    }

    runningRef.current = false;
  }, [analytics, locale, postCommand, reloadIframe]);

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true;
      return undefined;
    }

    if (runningRef.current) {
      return undefined;
    }

    cancelledRef.current = false;

    const onMessage = (event: MessageEvent) => {
      if (!isShowcaseMessage(event.data) || !('event' in event.data)) {
        return;
      }
      if (event.data.event === 'ready') {
        readyRef.current = true;
        analytics.track('showcase_iframe_ready', {
          persona: event.data.persona ?? personaRef.current,
          locale,
        });
      }
    };

    window.addEventListener('message', onMessage);
    void runTourLoop();

    return () => {
      cancelledRef.current = true;
      window.removeEventListener('message', onMessage);
    };
  }, [analytics, enabled, locale, runTourLoop]);

  return {
    pause: () => postCommand('pause'),
    resume: () => postCommand('resume'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitUntilReady(
  readyRef: React.RefObject<boolean>,
  timeoutMs: number
): Promise<void> {
  const start = Date.now();
  while (!readyRef.current) {
    if (Date.now() - start > timeoutMs) {
      return;
    }
    await sleep(200);
  }
}
