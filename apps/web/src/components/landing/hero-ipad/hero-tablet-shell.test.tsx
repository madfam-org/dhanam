import { render, screen, waitFor } from '@testing-library/react';

import { HeroTabletShell } from './hero-tablet-shell';

jest.mock('./hero-ipad-config', () => ({
  isHeroIpad3dEnabled: () => true,
}));

jest.mock('./hero-tablet-bezel-canvas', () => ({
  HeroTabletBezelCanvas: () => <div data-testid="tablet-canvas" />,
}));

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

describe('HeroTabletShell', () => {
  beforeEach(() => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width: 1024px'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    global.IntersectionObserver = jest.fn().mockImplementation((callback) => ({
      observe: jest.fn(() => {
        callback([{ isIntersecting: true }]);
      }),
      disconnect: jest.fn(),
      unobserve: jest.fn(),
    })) as unknown as typeof IntersectionObserver;
  });

  it('mounts a single persistent embed iframe after hydration', async () => {
    render(<HeroTabletShell locale="es" />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-embed')).toHaveAttribute('data-locale', 'es');
    });

    expect(screen.getAllByTestId('hero-embed')).toHaveLength(1);
    expect(document.querySelector('[data-hero-tablet-shell]')).toBeTruthy();
    const screenSlot = document.querySelector('[data-hero-tablet-screen]');
    expect(screenSlot).toHaveClass('lg:inset-x-[3.21%]');
    expect(screenSlot).toHaveClass('lg:inset-y-[2.82%]');
    expect(screenSlot).not.toHaveClass('lg:h-full');
    expect(screenSlot).not.toHaveClass('lg:w-full');
  });
});
