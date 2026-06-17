'use client';

import type { LandingLocale, ShowcasePersona } from '@dhanam/shared';
import { buildEmbedDemoUrl } from '@dhanam/shared';
import { useEffect, useRef, useState } from 'react';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { useShowcaseTourDriver } from '@/lib/showcase/use-showcase-tour-driver';

interface HeroEmbedFrameProps {
  locale: LandingLocale;
  persona?: ShowcasePersona;
  className?: string;
  onPauseChange?: (paused: boolean) => void;
}

export function HeroEmbedFrame({
  locale,
  persona = 'maria',
  className = '',
  onPauseChange,
}: HeroEmbedFrameProps) {
  const appUrl = usePublicAppUrl() || 'https://app.dhan.am';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const src = buildEmbedDemoUrl(appUrl, { persona, path: '/dashboard' });

  const { pause, resume } = useShowcaseTourDriver({
    iframeRef,
    appUrl,
    enabled: !failed && !paused,
    locale,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!iframeRef.current?.contentWindow) {
        return;
      }
    }, 25_000);
    return () => window.clearTimeout(timer);
  }, []);

  if (failed) {
    return <HeroProductPreview />;
  }

  return (
    <div
      className={`relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ${className}`}
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
        className="min-h-0 flex-1 w-full border-0 bg-background"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms"
        onError={() => setFailed(true)}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/90 to-transparent"
        aria-hidden
      />
    </div>
  );
}
