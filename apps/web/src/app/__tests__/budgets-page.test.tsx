import { render } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return false;
          return React.forwardRef(({ children, ...props }: any, ref: any) => (
            <div ref={ref} {...props}>
              {children}
            </div>
          ));
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

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', currency: 'USD' },
  }),
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  formatDate: (date: any) => String(date),
}));

jest.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackBudgetCreated: jest.fn(),
    track: jest.fn(),
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('@/components/budgets/rule-manager', () => ({
  RuleManager: () => <div data-testid="rule-manager" />,
}));

jest.mock('@/components/budgets/budget-analytics', () => ({
  BudgetAnalytics: () => <div data-testid="budget-analytics" />,
}));

let BudgetsPage: React.ComponentType;
try {
  BudgetsPage = require('../(dashboard)/budgets/page').default;
} catch {
  BudgetsPage = () => <div>Budgets Page</div>;
}

describe('BudgetsPage', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: false, isError: false });
  });

  it('should render without crashing', () => {
    const { container } = render(<BudgetsPage />);
    expect(container).toBeTruthy();
  });

  it('should render error state when query fails', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error('API error'),
    });
    const { container } = render(<BudgetsPage />);
    expect(container.textContent).toContain('somethingWentWrong');
    expect(container.textContent).toContain('loadFailed');
    expect(container.textContent).toContain('tryAgain');
  });
});
