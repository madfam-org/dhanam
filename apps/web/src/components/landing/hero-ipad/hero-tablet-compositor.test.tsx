import { render, screen } from '@testing-library/react';

import { HeroTabletCompositor } from './hero-tablet-compositor';

jest.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tablet-canvas">{children}</div>
  ),
}));

jest.mock('./procedural-tablet-mesh', () => ({
  ProceduralTabletMesh: () => <mesh data-testid="tablet-mesh" />,
}));

jest.mock('./hero-embed-frame', () => ({
  HeroEmbedFrame: ({ locale }: { locale: string }) => (
    <iframe title="Dhanam live demo" data-testid="hero-embed" data-locale={locale} />
  ),
}));

describe('HeroTabletCompositor', () => {
  it('layers a DOM iframe above the WebGL bezel canvas', () => {
    render(<HeroTabletCompositor locale="es" reducedMotion />);
    expect(screen.getByTestId('hero-embed')).toHaveAttribute('data-locale', 'es');
    expect(screen.getByTestId('tablet-canvas')).toBeInTheDocument();
    expect(document.querySelector('[data-hero-tablet-compositor]')).toBeTruthy();
  });
});
