/** ProceduralTabletMesh geometry — keep DOM screen insets in sync with these values. */
export const TABLET_MESH = {
  outer: { width: 2.8, height: 3.9, depth: 0.14, radius: 0.12 },
  inner: { width: 2.62, height: 3.68, depth: 0.018, radius: 0.09, z: 0.078 },
} as const;

function meshAxisInset(outer: number, inner: number): string {
  const pct = ((outer - inner) / 2 / outer) * 100;
  return `${pct.toFixed(2)}%`;
}

/** Screen cutout aligned to the inner recess of the WebGL bezel mesh. */
export const HERO_TABLET_SCREEN_INSET = {
  top: meshAxisInset(TABLET_MESH.outer.height, TABLET_MESH.inner.height),
  bottom: meshAxisInset(TABLET_MESH.outer.height, TABLET_MESH.inner.height),
  left: meshAxisInset(TABLET_MESH.outer.width, TABLET_MESH.inner.width),
  right: meshAxisInset(TABLET_MESH.outer.width, TABLET_MESH.inner.width),
} as const;

export const HERO_TABLET_MAX_WIDTH_PX = 420;

export const HERO_TABLET_SCENE_HEIGHT = 'min(72vh, 560px)';

/** Logical viewport inside the iframe — matches a portrait tablet (~10.9"). */
export const HERO_EMBED_VIEWPORT = {
  width: 820,
  height: 1100,
} as const;

/** Portrait tablet screen aspect ratio for CSS layout. */
export const HERO_TABLET_SCREEN_ASPECT = `${HERO_EMBED_VIEWPORT.width} / ${HERO_EMBED_VIEWPORT.height}`;
