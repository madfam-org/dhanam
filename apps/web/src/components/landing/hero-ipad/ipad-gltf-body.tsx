'use client';

import type { LandingLocale } from '@dhanam/shared';
import { Center, Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';

import { HeroEmbedFrame } from './hero-embed-frame';
import { HERO_IPAD_MODEL_PATH } from './hero-ipad-config';
import { ProceduralIpadBody } from './ipad-procedural-body';

/** Google Poly tablet mesh is ~54×72 units on XZ; scale to hero frame height ~3.9. */
const GLTF_SCALE = 3.9 / 71.68;

interface IpadGltfBodyProps {
  locale: LandingLocale;
}

function IpadGltfMesh({ locale }: IpadGltfBodyProps) {
  const { scene } = useGLTF(HERO_IPAD_MODEL_PATH);
  const model = useMemo(() => scene.clone(true), [scene]);

  return (
    <Center>
      <group rotation={[-Math.PI / 2, 0, 0]} scale={GLTF_SCALE}>
        <primitive object={model} />
        <Html
          transform
          occlude
          distanceFactor={1.05}
          position={[0, 0.03, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          style={{
            width: '360px',
            height: '270px',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <HeroEmbedFrame
            locale={locale}
            className="h-full w-full rounded-md border-0 shadow-none"
          />
        </Html>
      </group>
    </Center>
  );
}

export function IpadGltfBody({ locale }: IpadGltfBodyProps) {
  return (
    <Suspense fallback={<ProceduralIpadBody locale={locale} />}>
      <IpadGltfMesh locale={locale} />
    </Suspense>
  );
}

useGLTF.preload(HERO_IPAD_MODEL_PATH);

interface IpadRigProps {
  locale: LandingLocale;
  useGltf: boolean;
}

export function IpadRig({ locale, useGltf }: IpadRigProps) {
  const group = useRef<Group>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useFrame((state) => {
    if (!group.current) {
      return;
    }
    const t = state.clock.getElapsedTime();
    group.current.position.y = Math.sin(t * 0.55) * 0.06;
    group.current.rotation.y = pointer.x * 0.18;
    group.current.rotation.x = 0.12 + pointer.y * 0.08;
  });

  return (
    <group
      ref={group}
      onPointerMove={(event) => {
        setPointer({ x: event.pointer.x, y: event.pointer.y });
      }}
    >
      {useGltf ? <IpadGltfBody locale={locale} /> : <ProceduralIpadBody locale={locale} />}
    </group>
  );
}
