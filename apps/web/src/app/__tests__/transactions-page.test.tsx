import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/ui', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: React.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
  Badge: ({ children }: any) => <span>{children}</span>,
  Skeleton: () => <div data-testid="skeleton" />,
  Label: ({ children }: any) => <label>{children}</label>,
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  Separator: () => <hr />,
}));

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
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

const mockTransactionsQuery = jest
  .fn()
  .mockReturnValue({ data: null, isLoading: false, isError: false });
const mockAccountsQuery = jest.fn().mockReturnValue({ data: [], isLoading: false, isError: false });
const mockCategoriesQuery = jest
  .fn()
  .mockReturnValue({ data: [], isLoading: false, isError: false });

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts?.queryKey?.[0] ?? '';
    if (key === 'transactions') return mockTransactionsQuery();
    if (key === 'accounts') return mockAccountsQuery();
    if (key === 'categories') return mockCategoriesQuery();
    return { data: null, isLoading: false, isError: false };
  },
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', currency: 'USD' },
  }),
}));

jest.mock('~/lib/api/transactions', () => ({
  transactionsApi: { getTransactions: jest.fn(), createTransaction: jest.fn() },
}));

jest.mock('~/lib/api/accounts', () => ({
  accountsApi: { getAccounts: jest.fn() },
}));

jest.mock('~/lib/api/categories', () => ({
  categoriesApi: { getCategories: jest.fn() },
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  formatDate: (date: Date) => new Date(date).toLocaleDateString(),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('~/components/transactions/merchant-icon', () => ({
  MerchantIcon: () => <span data-testid="merchant-icon" />,
}));

jest.mock('~/components/transactions/transaction-filters', () => ({
  TransactionFilters: () => <div data-testid="transaction-filters" />,
  EMPTY_FILTERS: {
    search: '',
    categoryId: undefined,
    accountId: undefined,
    dateRange: 'all',
    type: 'all',
  },
}));

jest.mock('~/components/transactions/category-correction-dialog', () => ({
  CategoryCorrectionDialog: () => null,
}));

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
  }),
}));

import TransactionsPage from '../(dashboard)/transactions/page';

describe('TransactionsPage', () => {
  beforeEach(() => {
    mockTransactionsQuery.mockReturnValue({ data: null, isLoading: false, isError: false });
    mockAccountsQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
    mockCategoriesQuery.mockReturnValue({ data: [], isLoading: false, isError: false });
  });

  it('should render without crashing', () => {
    const { container } = render(<TransactionsPage />);
    expect(container).toBeTruthy();
  });

  it('should render error state when query fails', () => {
    mockTransactionsQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
    });
    render(<TransactionsPage />);
    expect(screen.getByText('somethingWentWrong')).toBeTruthy();
    expect(screen.getByText('loadFailed')).toBeTruthy();
    expect(screen.getByText('tryAgain')).toBeTruthy();
  });

  it('should render empty state when no transactions exist', () => {
    mockTransactionsQuery.mockReturnValue({
      data: { data: [], total: 0, page: 1, limit: 25 },
      isLoading: false,
      isError: false,
    });
    render(<TransactionsPage />);
    expect(screen.getByText('empty.title')).toBeTruthy();
    expect(screen.getByText('empty.description')).toBeTruthy();
  });
});
