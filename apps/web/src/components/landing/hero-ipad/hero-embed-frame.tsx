'use client';

import type { LandingLocale, ShowcasePersona } from '@dhanam/shared';
import { buildEmbedDemoUrl, SHOWCASE_MESSAGE_TYPE } from '@dhanam/shared';
import { useEffect, useRef, useState } from 'react';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { useShowcaseTourDriver } from '@/lib/showcase/use-showcase-tour-driver';

interface HeroEmbedFrameProps {
  locale: LandingLocale;
  persona?: ShowcasePersona;
  className?: string;
  /** Fills the tablet screen slot with no chrome — used inside HeroTabletShell. */
  chromeless?: boolean;
  onPauseChange?: (paused: boolean) => void;
}

export function HeroEmbedFrame({
  locale,
  persona = 'maria',
  className = '',
  chromeless = false,
  onPauseChange,
}: HeroEmbedFrameProps) {
  const appUrl = usePublicAppUrl() || 'https://app.dhan.am';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const src = buildEmbedDemoUrl(appUrl, { persona, path: '/dashboard' });

  const { pause, resume } = useShowcaseTourDriver({
    iframeRef,
    appUrl,
    enabled: !failed && !paused && iframeReady,
    locale,
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === SHOWCASE_MESSAGE_TYPE && event.data?.event === 'ready') {
        setIframeReady(true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (failed) {
    return <HeroProductPreview />;
  }

  const shellClass = chromeless
    ? `relative h-full min-h-0 overflow-hidden ${className}`
    : `relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ${className}`;

  return (
    <div
      className={shellClass}
      onMouseEnter={() => {
        setPaused(true);
        pause();
        onPauseChange?.(true);
      }}
      onMouseLeave={() => {
        setPaused(false);
        resume();
        onPauseChange?.(false);
      }}
    >
      <iframe
        ref={iframeRef}
        src={src}
        title="Dhanam live demo"
        className="h-full w-full border-0 bg-background"
        loading="eager"
        sandbox="allow-scripts allow-same-origin allow-forms"
        onError={() => setFailed(true)}
      />
      {!chromeless ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/90 to-transparent"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
