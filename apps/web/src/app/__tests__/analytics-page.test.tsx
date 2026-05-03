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

jest.mock('@dhanam/shared', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, params?: any) => key,
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
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />;
        },
      }
    )
);

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
  }),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
    setAuth: jest.fn(),
  }),
}));

jest.mock('~/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    track: jest.fn(),
    trackPageView: jest.fn(),
    trackViewNetWorth: jest.fn(),
    trackUpgradeCompleted: jest.fn(),
  }),
}));

jest.mock('@/lib/api/analytics', () => ({
  analyticsApi: {
    getNetWorth: jest.fn(),
    getNetWorthHistory: jest.fn(),
    getSpendingByCategory: jest.fn(),
    getIncomeVsExpenses: jest.fn(),
    getCashflowForecast: jest.fn(),
    getPortfolioAllocation: jest.fn(),
  },
}));

jest.mock('@/components/analytics', () => ({
  NetWorthChart: () => <div data-testid="net-worth-chart" />,
  IncomeExpenseChart: () => <div data-testid="income-expense-chart" />,
  SpendingCategoryChart: () => <div data-testid="spending-category-chart" />,
  PortfolioChart: () => <div data-testid="portfolio-chart" />,
}));

jest.mock('@/components/reports/schedule-report-modal', () => ({
  ScheduleReportModal: () => <div data-testid="schedule-report-modal" />,
}));

jest.mock('@/components/ml/ml-insights-dashboard', () => ({
  MlInsightsDashboard: () => <div data-testid="ml-insights-dashboard" />,
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number, currency: string) => `$${amount.toFixed(2)}`,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

import AnalyticsPage from '../(dashboard)/analytics/page';

// Allow per-test overrides of useSpaceStore
let mockUseSpaceStore: () => any;

jest.mock('@/stores/space', () => ({
  useSpaceStore: () => mockUseSpaceStore(),
}));

describe('AnalyticsPage', () => {
  beforeEach(() => {
    mockUseSpaceStore = () => ({
      currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
    });
  });

  it('should render the page title', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('should render metric cards for netWorth, totalAssets, totalLiabilities, debtRatio', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText('cards.netWorth')).toBeInTheDocument();
    expect(screen.getByText('cards.totalAssets')).toBeInTheDocument();
    expect(screen.getByText('cards.totalLiabilities')).toBeInTheDocument();
    expect(screen.getByText('cards.debtRatio')).toBeInTheDocument();
  });

  it('should render empty state when no space is selected', () => {
    mockUseSpaceStore = () => ({ currentSpace: null });
    render(<AnalyticsPage />);
    expect(screen.getByText('emptyState.noSpaceSelected')).toBeInTheDocument();
  });

  it('should render chart components', () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId('net-worth-chart')).toBeInTheDocument();
    expect(screen.getByTestId('income-expense-chart')).toBeInTheDocument();
    expect(screen.getByTestId('spending-category-chart')).toBeInTheDocument();
    expect(screen.getByTestId('portfolio-chart')).toBeInTheDocument();
  });

  it('should render ML insights dashboard', () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId('ml-insights-dashboard')).toBeInTheDocument();
  });
});
