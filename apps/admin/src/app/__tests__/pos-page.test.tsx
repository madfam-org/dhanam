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
          if (prop === 'Tabs') {
            return ({ children, value }: any) => (
              <div data-testid="tabs" data-value={value}>
                {children}
              </div>
            );
          }
          if (prop === 'TabsList') {
            return ({ children }: any) => <div data-testid="tabs-list">{children}</div>;
          }
          if (prop === 'TabsTrigger') {
            return ({ children, value }: any) => (
              <button type="button" data-testid={`tab-${value}`}>
                {children}
              </button>
            );
          }
          if (prop === 'TabsContent') {
            return ({ children, value }: any) => (
              <div data-testid={`tab-content-${value}`}>{children}</div>
            );
          }
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
    previewCheckoutRoute: jest.fn(),
    createPosCharge: jest.fn(),
    createPosRefund: jest.fn(),
    getPosTimeline: jest.fn(),
    getBillingReconciliation: jest.fn(),
  },
}));

import PosPage from '../(dashboard)/pos/page';

describe('PosPage', () => {
  it('renders the POS heading', () => {
    render(<PosPage />);
    expect(screen.getByText('MADFAM POS')).toBeInTheDocument();
  });

  it('renders tab navigation labels', () => {
    render(<PosPage />);
    expect(screen.getByText('Subscription')).toBeInTheDocument();
    expect(screen.getByText('Route Preview')).toBeInTheDocument();
    expect(screen.getByText('Charge / Refund')).toBeInTheDocument();
    expect(screen.getByText('Timeline / Reconcile')).toBeInTheDocument();
  });

  it('renders the checkout request fields', () => {
    render(<PosPage />);
    expect(screen.getByText('Checkout Request')).toBeInTheDocument();
    expect(screen.getAllByText('User ID').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Product').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Plan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Country').length).toBeGreaterThan(0);
  });

  it('renders the checkout result panel', () => {
    render(<PosPage />);
    expect(screen.getByText('Checkout Link')).toBeInTheDocument();
    expect(screen.getByText('No checkout link created')).toBeInTheDocument();
  });

  it('renders route preview and charge panels in tab content', () => {
    render(<PosPage />);
    expect(screen.getByText('Routing Matrix Preview')).toBeInTheDocument();
    expect(screen.getByText('Direct Charge')).toBeInTheDocument();
    expect(screen.getByText('Refund')).toBeInTheDocument();
    expect(screen.getByText('POS Timeline')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
  });
});
