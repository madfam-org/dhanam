import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return ({ children, ...props }: any) => (
            <div data-testid={String(prop).toLowerCase()} {...props}>
              {children}
            </div>
          );
        },
      }
    )
);

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />;
        },
      }
    )
);

jest.mock('@/lib/api/admin', () => ({
  adminApi: {
    createPosCheckout: jest.fn(),
    getPosCheckoutStatus: jest.fn(),
  },
}));

import PosPage from '../(dashboard)/pos/page';

describe('PosPage', () => {
  it('renders the POS heading', () => {
    render(<PosPage />);
    expect(screen.getByText('MADFAM POS')).toBeInTheDocument();
  });

  it('renders the checkout request fields', () => {
    render(<PosPage />);
    expect(screen.getByText('Checkout Request')).toBeInTheDocument();
    expect(screen.getByText('User ID')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Country')).toBeInTheDocument();
  });

  it('renders the checkout result panel', () => {
    render(<PosPage />);
    expect(screen.getByText('Checkout Link')).toBeInTheDocument();
    expect(screen.getByText('No checkout link created')).toBeInTheDocument();
  });

  it('renders the checkout status panel', () => {
    render(<PosPage />);
    expect(screen.getByText('Checkout Status')).toBeInTheDocument();
    expect(screen.getByText('No checkout status loaded')).toBeInTheDocument();
  });
});
