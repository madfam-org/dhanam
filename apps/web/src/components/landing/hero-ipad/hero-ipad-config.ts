export function isHeroIpadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HERO_IPAD_ENABLED === 'true';
}

export function isHeroIpad3dEnabled(): boolean {
  if (!isHeroIpadEnabled()) {
    return false;
  }
  return process.env.NEXT_PUBLIC_HERO_IPAD_3D !== 'false';
}

/** Sourced tablet GLB (CC BY 3.0 — see public/landing/models/LICENSE.md). */
export const HERO_IPAD_MODEL_PATH = '/landing/models/ipad-pro.glb';

export const HERO_IPAD_MODEL_ATTRIBUTION =
  'Tablet 3D model by Poly by Google (CC BY 3.0), via Poly Pizza';
