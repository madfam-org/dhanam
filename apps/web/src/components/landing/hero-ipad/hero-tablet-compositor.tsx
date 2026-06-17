'use client';

import type { LandingLocale } from '@dhanam/shared';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

import { HeroEmbedFrame } from './hero-embed-frame';
import {
  HERO_TABLET_MAX_WIDTH_PX,
  HERO_TABLET_SCENE_HEIGHT,
  HERO_TABLET_SCREEN_INSET,
} from './hero-tablet-layout';
import { ProceduralTabletMesh } from './procedural-tablet-mesh';
import { useHeroTabletMotion } from './use-hero-tablet-motion';

interface HeroTabletCompositorProps {
  locale: LandingLocale;
  reducedMotion?: boolean;
}

function TabletBezelCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 34 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      className="pointer-events-none !h-full !w-full"
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />
      <Suspense fallback={null}>
        <ProceduralTabletMesh />
      </Suspense>
    </Canvas>
  );
}

/**
 * Desktop hero tablet — WebGL bezel + DOM iframe composited with shared CSS transforms.
 * Avoids @react-three/drei Html (unreliable 0×0 iframe projection in production).
 */
export function HeroTabletCompositor({ locale, reducedMotion = false }: HeroTabletCompositorProps) {
  const { transform, onPointerMove, onPointerLeave } = useHeroTabletMotion(reducedMotion);

  return (
    <div
      className="relative w-full"
      style={{ height: HERO_TABLET_SCENE_HEIGHT }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      data-hero-tablet-compositor
    >
      <div
        className="relative mx-auto h-full w-full"
        style={{ maxWidth: HERO_TABLET_MAX_WIDTH_PX, transform, transformStyle: 'preserve-3d' }}
      >
        <div
          className="absolute z-20 flex h-auto flex-col overflow-hidden rounded-[0.85rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          style={{
            top: HERO_TABLET_SCREEN_INSET.top,
            right: HERO_TABLET_SCREEN_INSET.right,
            bottom: HERO_TABLET_SCREEN_INSET.bottom,
            left: HERO_TABLET_SCREEN_INSET.left,
          }}
        >
          <HeroEmbedFrame
            locale={locale}
            className="h-full w-full rounded-none border-0 shadow-none"
          />
        </div>

        <div className="absolute inset-0 z-10">
          <TabletBezelCanvas />
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-30 rounded-[1.75rem] ring-1 ring-white/10"
          aria-hidden
        />
      </div>
    </div>
  );
}
