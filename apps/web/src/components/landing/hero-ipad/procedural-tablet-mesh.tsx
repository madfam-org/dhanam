'use client';

import { RoundedBox } from '@react-three/drei';

import { TABLET_MESH } from './hero-tablet-layout';

/** WebGL tablet bezel only — screen content is a DOM iframe layered above the canvas. */
export function ProceduralTabletMesh() {
  const { outer, inner } = TABLET_MESH;

  return (
    <>
      <RoundedBox
        args={[outer.width, outer.height, outer.depth]}
        radius={outer.radius}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#1c1c22" metalness={0.72} roughness={0.28} />
      </RoundedBox>

      <RoundedBox
        args={[inner.width, inner.height, inner.depth]}
        radius={inner.radius}
        smoothness={3}
        position={[0, 0, inner.z]}
      >
        <meshStandardMaterial color="#08080a" metalness={0.35} roughness={0.85} />
      </RoundedBox>
    </>
  );
}
