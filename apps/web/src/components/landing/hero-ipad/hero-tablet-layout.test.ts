import { HERO_TABLET_SCREEN_INSET, TABLET_MESH } from './hero-tablet-layout';

describe('hero-tablet-layout', () => {
  it('derives DOM screen insets from procedural mesh dimensions', () => {
    const { outer, inner } = TABLET_MESH;
    expect(HERO_TABLET_SCREEN_INSET.top).toBe('2.82%');
    expect(HERO_TABLET_SCREEN_INSET.bottom).toBe('2.82%');
    expect(HERO_TABLET_SCREEN_INSET.left).toBe('3.21%');
    expect(HERO_TABLET_SCREEN_INSET.right).toBe('3.21%');
    expect(parseFloat(HERO_TABLET_SCREEN_INSET.left)).toBeCloseTo(
      ((outer.width - inner.width) / 2 / outer.width) * 100,
      2
    );
  });
});
