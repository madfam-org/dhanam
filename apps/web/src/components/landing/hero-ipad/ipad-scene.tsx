'use client';

import type { LandingLocale } from '@dhanam/shared';
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

import { IpadRig } from './ipad-gltf-body';
import { ProceduralIpadBody } from './ipad-procedural-body';

interface IpadSceneProps {
  locale: LandingLocale;
}

export function IpadScene({ locale }: IpadSceneProps) {
  const useGltf = true;

  return (
    <div className="h-[min(72vh,560px)] w-full">
      <Canvas camera={{ position: [0, 0.1, 5.2], fov: 34 }} dpr={[1, 1.75]} gl={{ alpha: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 5]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        <Suspense fallback={<ProceduralIpadBody locale={locale} />}>
          <IpadRig locale={locale} useGltf={useGltf} />
        </Suspense>
      </Canvas>
    </div>
  );
}
