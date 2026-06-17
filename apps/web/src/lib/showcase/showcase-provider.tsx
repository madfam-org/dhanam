'use client';

import {
  isAllowedShowcaseParentOrigin,
  isShowcaseMessage,
  SHOWCASE_MESSAGE_TYPE,
  type ShowcaseChildEvent,
  type ShowcaseParentCommand,
} from '@dhanam/shared';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDemoRouter } from '@/lib/hooks/use-demo-router';

import { ShowcaseGhostCursor } from './showcase-ghost-cursor';
import { ShowcaseHighlight } from './showcase-highlight';

function postToParent(event: ShowcaseChildEvent, parentOrigin: string) {
  if (typeof window === 'undefined' || window.parent === window) {
    return;
  }
  window.parent.postMessage(event, parentOrigin);
}

export function ShowcaseProvider({ children }: { children: React.ReactNode }) {
  const router = useDemoRouter();
  const searchParams = useSearchParams();
  const showcaseEnabled = searchParams.get('showcase') === '1';
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [cursorPoints, setCursorPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [cursorDuration, setCursorDuration] = useState(0);
  const [cursorActive, setCursorActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const parentOriginRef = useRef<string | null>(null);

  const emitReady = useCallback(() => {
    const parentOrigin = parentOriginRef.current;
    if (!parentOrigin) {
      return;
    }
    postToParent(
      {
        type: SHOWCASE_MESSAGE_TYPE,
        event: 'ready',
        path: window.location.pathname,
        persona: searchParams.get('persona') ?? undefined,
      },
      parentOrigin
    );
  }, [searchParams]);

  const runCommand = useCallback(
    async (command: ShowcaseParentCommand) => {
      if (paused && command.action !== 'resume') {
        return;
      }

      switch (command.action) {
        case 'pause':
          setPaused(true);
          break;
        case 'resume':
          setPaused(false);
          break;
        case 'navigate': {
          const path = command.path.startsWith('/') ? command.path : `/${command.path}`;
          router.push(path);
          const parentOrigin = parentOriginRef.current;
          if (parentOrigin) {
            window.setTimeout(() => {
              postToParent(
                {
                  type: SHOWCASE_MESSAGE_TYPE,
                  event: 'route-changed',
                  path,
                },
                parentOrigin
              );
            }, 450);
          }
          break;
        }
        case 'highlight':
          setHighlightTarget(command.target);
          window.setTimeout(() => setHighlightTarget(null), command.durationMs ?? 2400);
          break;
        case 'scroll':
          window.scrollTo({ top: command.y, behavior: command.behavior ?? 'smooth' });
          break;
        case 'cursor':
          setCursorPoints(command.points);
          setCursorDuration(command.durationMs);
          setCursorActive(true);
          window.setTimeout(() => setCursorActive(false), command.durationMs);
          break;
        case 'restart':
          router.push('/dashboard');
          break;
        case 'switch-persona':
          // Parent reloads iframe with new persona — no-op in child.
          break;
        default:
          break;
      }
    },
    [paused, router]
  );

  useEffect(() => {
    if (!showcaseEnabled) {
      return undefined;
    }

    const onMessage = (event: MessageEvent) => {
      if (!isAllowedShowcaseParentOrigin(event.origin)) {
        return;
      }
      if (!isShowcaseMessage(event.data)) {
        return;
      }

      parentOriginRef.current = event.origin;

      if ('action' in event.data) {
        void runCommand(event.data);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [runCommand, showcaseEnabled]);

  useEffect(() => {
    if (!showcaseEnabled) {
      return undefined;
    }

    const timer = window.setTimeout(() => emitReady(), 900);
    return () => window.clearTimeout(timer);
  }, [emitReady, showcaseEnabled]);

  if (!showcaseEnabled) {
    return children;
  }

  return (
    <>
      {children}
      <ShowcaseHighlight target={highlightTarget} />
      <ShowcaseGhostCursor
        points={cursorPoints}
        durationMs={cursorDuration}
        active={cursorActive}
      />
    </>
  );
}
