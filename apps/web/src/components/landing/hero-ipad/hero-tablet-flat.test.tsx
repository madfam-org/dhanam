import { render, screen, waitFor } from '@testing-library/react';

import { HeroTabletFlat } from './hero-tablet-flat';

jest.mock('./hero-tablet-shell', () => ({
  HeroTabletShell: ({ locale }: { locale: string }) => (
    <div data-hero-tablet-flat data-locale={locale}>
      <iframe title="Dhanam live demo" data-testid="hero-embed" data-locale={locale} />
    </div>
  ),
}));

describe('HeroTabletFlat', () => {
  it('delegates to HeroTabletShell', async () => {
    render(<HeroTabletFlat locale="es" />);
    await waitFor(() => {
      expect(screen.getByTestId('hero-embed')).toHaveAttribute('data-locale', 'es');
    });
    expect(document.querySelector('[data-hero-tablet-flat]')).toBeTruthy();
  });
});
