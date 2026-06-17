/** Shared screen cutout — DOM iframe and WebGL bezel stay aligned. */
export const HERO_TABLET_SCREEN_INSET = {
  top: '9.5%',
  right: '10.5%',
  bottom: '13.5%',
  left: '10.5%',
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
