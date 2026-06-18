'use client';

import { useEffect, useRef } from 'react';

interface ShowcaseHighlightProps {
  target: string | null;
  durationMs?: number;
}

export function ShowcaseHighlight({ target, durationMs = 2400 }: ShowcaseHighlightProps) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!target) {
      return undefined;
    }

    const selector = target.startsWith('nav-')
      ? `[data-showcase-nav-item="${target.slice(4)}"]`
      : `[data-showcase="${target}"], [data-tour="${target}"]`;
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      return undefined;
    }

    element.classList.add('showcase-highlight-pulse');
    timerRef.current = window.setTimeout(() => {
      element.classList.remove('showcase-highlight-pulse');
    }, durationMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      element.classList.remove('showcase-highlight-pulse');
    };
  }, [target, durationMs]);

  return null;
}
