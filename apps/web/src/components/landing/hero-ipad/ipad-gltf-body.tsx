'use client';

import { Center, useGLTF } from '@react-three/drei';
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { Mesh, MeshStandardMaterial, type Group, type Material } from 'three';

import { HERO_IPAD_MODEL_PATH } from './hero-ipad-config';
import { ProceduralTabletMesh } from './procedural-tablet-mesh';

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

function IpadGltfMesh() {
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
      </group>
    </Center>
  );
}

export function IpadGltfBody() {
  return (
    <GltfErrorBoundary fallback={<ProceduralTabletMesh />}>
      <Suspense fallback={<ProceduralTabletMesh />}>
        <IpadGltfMesh />
      </Suspense>
    </GltfErrorBoundary>
  );
}

interface IpadRigProps {
  useGltf: boolean;
}

/** Legacy rig — prefer HeroTabletCompositor for production hero. */
export function IpadRig({ useGltf }: IpadRigProps) {
  return <group>{useGltf ? <IpadGltfBody /> : <ProceduralTabletMesh />}</group>;
}
