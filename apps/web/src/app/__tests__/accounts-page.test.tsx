import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return false;
          return ({ children, ...props }: any) => <div {...props}>{children}</div>;
        },
      }
    )
);

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
  AccountType: {},
  Currency: {},
  Provider: {},
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: () => (props: any) => <span {...props} />,
      }
    )
);

const mockUseQuery = jest.fn().mockReturnValue({ data: null, isLoading: false, isError: false });

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', currency: 'USD' },
  }),
}));

jest.mock('@/lib/api/accounts', () => ({
  accountsApi: { getAccounts: jest.fn(), createAccount: jest.fn() },
}));

jest.mock('@/lib/utils', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/providers/belvo-connect', () => ({
  BelvoConnect: () => <div data-testid="belvo-connect" />,
}));

jest.mock('@/components/providers/plaid-connect', () => ({
  PlaidConnect: () => <div data-testid="plaid-connect" />,
}));

jest.mock('@/components/providers/bitso-connect', () => ({
  BitsoConnect: () => <div data-testid="bitso-connect" />,
}));

import AccountsPage from '../(dashboard)/accounts/page';

describe('AccountsPage', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false, isError: false });
  });

  it('should render without crashing', () => {
    const { container } = render(<AccountsPage />);
    expect(container).toBeTruthy();
  });

  it('should render error state when query fails', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
    });
    render(<AccountsPage />);
    expect(screen.getByText('somethingWentWrong')).toBeTruthy();
    expect(screen.getByText('loadFailed')).toBeTruthy();
    expect(screen.getByText('tryAgain')).toBeTruthy();
  });

  it('should render empty state when no accounts exist', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<AccountsPage />);
    expect(screen.getByText('empty.title')).toBeTruthy();
  });
});
