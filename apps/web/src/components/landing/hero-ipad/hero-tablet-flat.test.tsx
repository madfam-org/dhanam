import { render, screen } from '@testing-library/react';

import { HeroTabletFlat } from './hero-tablet-flat';

jest.mock('./hero-embed-frame', () => ({
  HeroEmbedFrame: ({ locale }: { locale: string }) => (
    <iframe title="Dhanam live demo" data-testid="hero-embed" data-locale={locale} />
  ),
}));

describe('HeroTabletFlat', () => {
  it('renders a live demo iframe inside the CSS tablet frame', () => {
    render(<HeroTabletFlat locale="es" />);
    expect(screen.getByTestId('hero-embed')).toHaveAttribute('data-locale', 'es');
    expect(screen.getByTitle('Dhanam live demo')).toBeInTheDocument();
    expect(document.querySelector('[data-hero-tablet-flat]')).toBeTruthy();
  });
});
