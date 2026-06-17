'use client';

import type { LandingLocale, ShowcasePersona } from '@dhanam/shared';
import { buildEmbedDemoUrl, SHOWCASE_MESSAGE_TYPE } from '@dhanam/shared';
import { useEffect, useRef, useState } from 'react';

import { HeroProductPreview } from '@/components/landing/hero-product-preview';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { useShowcaseTourDriver } from '@/lib/showcase/use-showcase-tour-driver';

import { HERO_EMBED_VIEWPORT } from './hero-tablet-layout';

interface HeroEmbedFrameProps {
  locale: LandingLocale;
  persona?: ShowcasePersona;
  className?: string;
  onPauseChange?: (paused: boolean) => void;
}

function useTabletEmbedScale(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const update = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        return;
      }

      const scale = Math.min(
        width / HERO_EMBED_VIEWPORT.width,
        height / HERO_EMBED_VIEWPORT.height
      );
      const scaledWidth = HERO_EMBED_VIEWPORT.width * scale;
      const scaledHeight = HERO_EMBED_VIEWPORT.height * scale;

      setLayout({
        scale,
        offsetX: (width - scaledWidth) / 2,
        offsetY: (height - scaledHeight) / 2,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  return layout;
}

export function HeroEmbedFrame({
  locale,
  persona = 'maria',
  className = '',
  onPauseChange,
}: HeroEmbedFrameProps) {
  const appUrl = usePublicAppUrl() || 'https://app.dhan.am';
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const src = buildEmbedDemoUrl(appUrl, { persona, path: '/dashboard' });
  const { scale, offsetX, offsetY } = useTabletEmbedScale(containerRef);

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

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ${className}`}
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
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <iframe
          ref={iframeRef}
          src={src}
          title="Dhanam live demo"
          className="absolute border-0 bg-background"
          style={{
            width: HERO_EMBED_VIEWPORT.width,
            height: HERO_EMBED_VIEWPORT.height,
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
            transformOrigin: 'top left',
          }}
          loading="eager"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onError={() => setFailed(true)}
        />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card/90 to-transparent"
        aria-hidden
      />
    </div>
  );
}
