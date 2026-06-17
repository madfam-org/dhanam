import { render, screen, waitFor } from '@testing-library/react';

import { HeroTabletCompositor } from './hero-tablet-compositor';

jest.mock('./hero-tablet-shell', () => ({
  HeroTabletShell: ({ locale }: { locale: string }) => (
    <div data-hero-tablet-compositor data-locale={locale}>
      <iframe title="Dhanam live demo" data-testid="hero-embed" data-locale={locale} />
    </div>
  ),
}));

describe('HeroTabletCompositor', () => {
  it('delegates to HeroTabletShell', async () => {
    render(<HeroTabletCompositor locale="es" reducedMotion />);
    await waitFor(() => {
      expect(screen.getByTestId('hero-embed')).toHaveAttribute('data-locale', 'es');
    });
    expect(document.querySelector('[data-hero-tablet-compositor]')).toBeTruthy();
  });
});
