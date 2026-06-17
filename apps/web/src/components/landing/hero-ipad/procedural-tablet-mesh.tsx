'use client';

import { RoundedBox } from '@react-three/drei';

/** WebGL tablet bezel only — screen content is a DOM iframe layered above the canvas. */
export function ProceduralTabletMesh() {
  return (
    <>
      <RoundedBox args={[2.8, 3.9, 0.14]} radius={0.12} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#1c1c22" metalness={0.72} roughness={0.28} />
      </RoundedBox>

      <RoundedBox args={[2.62, 3.68, 0.018]} radius={0.09} smoothness={3} position={[0, 0, 0.078]}>
        <meshStandardMaterial color="#08080a" metalness={0.35} roughness={0.85} />
      </RoundedBox>
    </>
  );
}
