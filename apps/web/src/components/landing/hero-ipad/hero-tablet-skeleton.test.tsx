import { render } from '@testing-library/react';

import { HeroTabletSkeleton } from './hero-tablet-skeleton';
import { HERO_TABLET_SCREEN_INSET_CLASSES } from './hero-tablet-layout';

describe('HeroTabletSkeleton', () => {
  it('matches production screen inset classes before hydration', () => {
    render(<HeroTabletSkeleton locale="es" />);
    const screenSlot = document.querySelector('[data-hero-tablet-skeleton] > div');
    expect(screenSlot).toHaveClass(...HERO_TABLET_SCREEN_INSET_CLASSES.split(' '));
    expect(screenSlot).toHaveClass('max-lg:aspect-[820/1100]');
  });
});
