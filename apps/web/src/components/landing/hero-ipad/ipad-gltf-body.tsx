'use client';

import type { LandingLocale } from '@dhanam/shared';
import { Center, Html, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mesh, MeshStandardMaterial, type Group, type Material } from 'three';

import { HeroEmbedFrame } from './hero-embed-frame';
import { HERO_IPAD_MODEL_PATH } from './hero-ipad-config';
import { ProceduralIpadBody } from './ipad-procedural-body';

/** Google Poly tablet mesh is ~54×72 units on XZ; scale to hero frame height ~3.9. */
const GLTF_SCALE = 3.9 / 71.68;

function materialBaseColor(material: Material | Material[]): number {
  const source = Array.isArray(material) ? material[0] : material;
  if (source instanceof MeshStandardMaterial) {
    return source.color.getHex();
  }
  return 0x2a2a30;
}

/** Strip embedded GLB textures so Three.js never creates blob: URLs (CSP-safe). */
function applyUntexturedMaterials(root: Group): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    const color = materialBaseColor(object.material);
    object.material = new MeshStandardMaterial({
      color,
      metalness: 0.35,
      roughness: 0.55,
    });
  });
}

class GltfErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

interface IpadGltfBodyProps {
  locale: LandingLocale;
}

function IpadGltfMesh({ locale }: IpadGltfBodyProps) {
  const { scene } = useGLTF(HERO_IPAD_MODEL_PATH);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    applyUntexturedMaterials(clone);
    return clone;
  }, [scene]);

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
    <GltfErrorBoundary fallback={<ProceduralIpadBody locale={locale} />}>
      <Suspense fallback={<ProceduralIpadBody locale={locale} />}>
        <IpadGltfMesh locale={locale} />
      </Suspense>
    </GltfErrorBoundary>
  );
}

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
