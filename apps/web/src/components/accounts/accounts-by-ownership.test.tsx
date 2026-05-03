import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { AccountsByOwnership } from './accounts-by-ownership';

// Mock @dhanam/ui components
jest.mock('@dhanam/ui', () => ({
  Skeleton: ({ className }: any) => <div data-testid="skeleton" className={className} />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Wallet: (props: any) => <span data-testid="icon-wallet" {...props} />,
  TrendingUp: (props: any) => <span data-testid="icon-trending-up" {...props} />,
  TrendingDown: (props: any) => <span data-testid="icon-trending-down" {...props} />,
}));

// Mock ownership-toggle
jest.mock('./ownership-toggle', () => ({
  OwnershipToggle: ({ onFilterChange }: any) => (
    <div data-testid="ownership-toggle">
      <button data-testid="filter-yours" onClick={() => onFilterChange('yours')}>
        Yours
      </button>
      <button data-testid="filter-mine" onClick={() => onFilterChange('mine')}>
        Mine
      </button>
      <button data-testid="filter-ours" onClick={() => onFilterChange('ours')}>
        Ours
      </button>
    </div>
  ),
}));

// Mock @/components/ui/card and badge
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: any) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'Main Checking',
    type: 'checking',
    balance: 5000.5,
    currency: 'USD',
    ownership: 'individual',
  },
  {
    id: 'acc-2',
    name: 'Investment Portfolio',
    type: 'investment',
    balance: 25000,
    currency: 'USD',
    ownership: 'individual',
  },
  {
    id: 'acc-3',
    name: 'Credit Card',
    type: 'credit',
    balance: -1500,
    currency: 'USD',
    ownership: 'individual',
  },
];

const mockNetWorth = {
  yours: 28500.5,
  mine: 15000,
  ours: 50000,
  total: 93500.5,
};

// Helper to set up fetch mock responses
function setupFetchMock(options: {
  accounts?: any[];
  netWorth?: any;
  accountsError?: boolean;
  netWorthError?: boolean;
  pending?: boolean;
}) {
  global.fetch = jest.fn((url: string) => {
    if (typeof url === 'string' && url.includes('net-worth')) {
      if (options.netWorthError) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(options.netWorth ?? mockNetWorth),
      });
    }
    if (typeof url === 'string' && url.includes('by-ownership')) {
      if (options.pending) {
        return new Promise(() => {});
      }
      if (options.accountsError) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(options.accounts ?? mockAccounts),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as jest.Mock;
}

describe('AccountsByOwnership', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render account groups by ownership', async () => {
    setupFetchMock({ accounts: mockAccounts });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('Main Checking')).toBeInTheDocument();
    });

    expect(screen.getByText('Investment Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Your Accounts')).toBeInTheDocument();
    expect(screen.getByTestId('ownership-toggle')).toBeInTheDocument();
  });

  it('should show net worth calculations as formatted currency', async () => {
    setupFetchMock({ accounts: mockAccounts });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('$5,000.50')).toBeInTheDocument();
    });

    expect(screen.getByText('$25,000.00')).toBeInTheDocument();
    expect(screen.getByText('-$1,500.00')).toBeInTheDocument();
  });

  it('should show trending up icon for investment accounts', async () => {
    setupFetchMock({ accounts: [mockAccounts[1]] });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('Investment Portfolio')).toBeInTheDocument();
    });

    expect(screen.getByTestId('icon-trending-up')).toBeInTheDocument();
  });

  it('should show trending down icon for credit accounts', async () => {
    setupFetchMock({ accounts: [mockAccounts[2]] });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('icon-trending-down')).toBeInTheDocument();
  });

  it('should handle empty account lists', async () => {
    setupFetchMock({ accounts: [] });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('You have no individual accounts yet.')).toBeInTheDocument();
    });
  });

  it('should show loading skeleton state', () => {
    setupFetchMock({ pending: true });

    render(<AccountsByOwnership spaceId="space-1" />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should display error state when fetch fails', async () => {
    setupFetchMock({ accountsError: true });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load accounts')).toBeInTheDocument();
    });
  });

  it('should show partner name for mine filter', async () => {
    setupFetchMock({ accounts: [] });

    render(<AccountsByOwnership spaceId="space-1" partnerName="Alex" />);

    // Click the "mine" filter
    const mineButton = screen.getByTestId('filter-mine');
    mineButton.click();

    await waitFor(() => {
      expect(screen.getByText('Alex has no individual accounts yet.')).toBeInTheDocument();
    });
  });

  it('should show joint accounts heading for ours filter', async () => {
    setupFetchMock({ accounts: [] });

    render(<AccountsByOwnership spaceId="space-1" />);

    const oursButton = screen.getByTestId('filter-ours');
    oursButton.click();

    await waitFor(() => {
      expect(screen.getByText('Joint Accounts')).toBeInTheDocument();
    });
  });

  it('should render badge with correct variant for account types', async () => {
    setupFetchMock({ accounts: mockAccounts });

    render(<AccountsByOwnership spaceId="space-1" />);

    await waitFor(() => {
      expect(screen.getByText('Main Checking')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveAttribute('data-variant', 'default');
    expect(badges[1]).toHaveAttribute('data-variant', 'secondary');
    expect(badges[2]).toHaveAttribute('data-variant', 'outline');
  });
});
