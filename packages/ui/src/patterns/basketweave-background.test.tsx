import { render, screen } from '@testing-library/react';

import { BasketweaveSurface } from './basketweave-background';

describe('BasketweaveSurface', () => {
  it('renders a decorative surface layer', () => {
    render(<BasketweaveSurface data-testid="basketweave" />);
    const surface = screen.getByTestId('basketweave');
    expect(surface).toHaveAttribute('aria-hidden', 'true');
    expect(surface).toHaveClass('dhanam-basketweave-surface');
  });

  it('applies landing variant class', () => {
    render(<BasketweaveSurface variant="landing" data-testid="basketweave" />);
    expect(screen.getByTestId('basketweave')).toHaveClass('landing-basketweave');
  });
});
