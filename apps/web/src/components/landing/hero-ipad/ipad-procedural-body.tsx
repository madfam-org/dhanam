'use client';

import type { LandingLocale } from '@dhanam/shared';
import { Html, RoundedBox } from '@react-three/drei';

import { HeroEmbedFrame } from './hero-embed-frame';

interface ProceduralIpadBodyProps {
  locale: LandingLocale;
}

/** Fallback when GLB is missing or still loading. */
export function ProceduralIpadBody({ locale }: ProceduralIpadBodyProps) {
  return (
    <>
      <RoundedBox args={[2.8, 3.9, 0.14]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#1c1c22" metalness={0.7} roughness={0.32} />
      </RoundedBox>

      <RoundedBox args={[2.55, 3.55, 0.02]} radius={0.08} smoothness={3} position={[0, 0, 0.075]}>
        <meshStandardMaterial color="#0a0a0c" metalness={0.2} roughness={0.9} />
      </RoundedBox>

      <Html
        transform
        occlude
        distanceFactor={1.18}
        position={[0, 0, 0.09]}
        style={{
          width: '390px',
          height: '292px',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        <HeroEmbedFrame locale={locale} className="h-full w-full rounded-lg border-0 shadow-none" />
      </Html>
    </>
  );
}
