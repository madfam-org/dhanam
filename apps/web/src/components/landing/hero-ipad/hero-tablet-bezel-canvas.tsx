'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';

import { ProceduralTabletMesh } from './procedural-tablet-mesh';

/** WebGL tablet bezel — screen content is a DOM iframe layered above. */
export function HeroTabletBezelCanvas() {
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
