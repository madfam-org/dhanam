import heroIpadModelUrl from '@/assets/landing/ipad-pro.glb';

export function isHeroIpadEnabled(): boolean {
  return process.env.NEXT_PUBLIC_HERO_IPAD_ENABLED === 'true';
}

export function isHeroIpad3dEnabled(): boolean {
  if (!isHeroIpadEnabled()) {
    return false;
  }
  return process.env.NEXT_PUBLIC_HERO_IPAD_3D !== 'false';
}

/** Bundled via webpack — survives Docker public/ path issues; also copied under public/ for direct URL smoke. */
export const HERO_IPAD_MODEL_PATH = heroIpadModelUrl;

export const HERO_IPAD_MODEL_ATTRIBUTION =
  'Tablet 3D model by Poly by Google (CC BY 3.0), via Poly Pizza';
