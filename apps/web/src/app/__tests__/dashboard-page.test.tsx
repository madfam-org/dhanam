import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/ui', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  Skeleton: () => <div data-testid="skeleton" />,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Progress: ({ value }: any) => <div data-testid="progress" data-value={value} />,
}));

const commonAriaKeys: Record<string, string> = {
  'aria.income': 'Income',
  'aria.expense': 'Expense',
  'aria.negative': 'Negative',
  'aria.positive': 'Positive',
};

jest.mock('@dhanam/shared', () => ({
  useTranslation: (namespace?: string) => ({
    t: (key: string, params?: any) => {
      if (namespace === 'common') return commonAriaKeys[key] ?? key;
      if (params?.name) return `Welcome, ${params.name}`;
      return key;
    },
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

jest.mock('lucide-react', () => ({
  TrendingUp: (props: any) => <span {...props} />,
  TrendingDown: (props: any) => <span {...props} />,
  CreditCard: (props: any) => <span {...props} />,
  PiggyBank: (props: any) => <span {...props} />,
  Target: (props: any) => <span {...props} />,
  Wallet: (props: any) => <span {...props} />,
  Receipt: (props: any) => <span {...props} />,
  Building2: (props: any) => <span {...props} />,
  Loader2: (props: any) => <span {...props} />,
  Gamepad2: (props: any) => <span {...props} />,
  AlertCircle: (props: any) => <span {...props} />,
  RefreshCw: (props: any) => <span {...props} />,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  }),
}));

jest.mock('~/lib/api/analytics', () => ({
  analyticsApi: { getDashboardData: jest.fn() },
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number) => `$${amount?.toFixed?.(2) ?? '0.00'}`,
  formatDate: (date: any) => String(date),
  formatDateShort: (date: any) => String(date),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/components/sync/sync-status', () => ({
  SyncStatus: () => <div data-testid="sync-status" />,
}));

jest.mock('@/components/demo/help-tooltip', () => ({
  HelpTooltip: () => <span data-testid="help-tooltip" />,
}));

jest.mock('@/components/demo/analytics-empty-state', () => ({
  AnalyticsEmptyState: () => <div data-testid="empty-state" />,
}));

jest.mock('@/components/goals/probabilistic-goal-card', () => ({
  ProbabilisticGoalCard: () => <div data-testid="goal-card" />,
}));

jest.mock('@/components/goals/goal-health-score', () => ({
  GoalHealthScore: () => <div data-testid="goal-health" />,
}));

jest.mock('@/components/goals/goal-probability-timeline', () => ({
  GoalProbabilityTimeline: () => <div data-testid="goal-timeline" />,
}));

jest.mock('@/components/billing/PremiumGate', () => ({
  PremiumGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/demo/demo-tour', () => ({
  DemoTour: () => <div data-testid="demo-tour" />,
}));

jest.mock('@/components/insights/savings-streak', () => ({
  SavingsStreak: () => <div data-testid="savings-streak" />,
}));

jest.mock('@/components/insights/insight-cards', () => ({
  InsightCards: () => <div data-testid="insight-cards" />,
}));

jest.mock('recharts', () => ({
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('~/components/onboarding/onboarding-wizard', () => ({
  OnboardingWizard: () => <div data-testid="onboarding-wizard" />,
}));

jest.mock('~/components/dashboard/insights-card', () => ({
  InsightsCard: () => <div data-testid="insights-card" />,
}));

jest.mock('~/components/dashboard/weekly-summary', () => ({
  WeeklySummary: () => <div data-testid="weekly-summary" />,
}));

jest.mock('~/lib/celebrations', () => ({
  fireStreakCelebration: jest.fn(),
  fireGoalConfetti: jest.fn(),
}));

jest.mock('~/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackViewNetWorth: jest.fn(),
    track: jest.fn(),
  }),
}));

import DashboardPage from '../(dashboard)/dashboard/page';

// Allow per-test overrides of useSpaces and useSpaceStore
let mockUseSpaces: () => any;
let mockUseSpaceStore: () => any;

jest.mock('~/lib/hooks/use-spaces', () => ({
  useSpaces: () => mockUseSpaces(),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => mockUseSpaceStore(),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    // Defaults: spaces loaded, current space set
    mockUseSpaces = () => ({
      data: [{ id: 'space-1', name: 'Personal', currency: 'USD' }],
      isLoading: false,
    });
    mockUseSpaceStore = () => ({
      currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
    });
  });

  it('should render welcome message as h1 heading', () => {
    render(<DashboardPage />);

    const heading = screen.getByText('Welcome, Test User');
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toBe('H1');
  });

  it('should have aria-live polite on the main content wrapper', () => {
    render(<DashboardPage />);

    const wrapper = screen.getByText('Welcome, Test User').closest('[aria-live]');
    expect(wrapper).toHaveAttribute('aria-live', 'polite');
  });

  it('should render key metric cards', () => {
    render(<DashboardPage />);

    expect(screen.getByText('overview.netWorth')).toBeInTheDocument();
    expect(screen.getByText('overview.totalAssets')).toBeInTheDocument();
    expect(screen.getByText('overview.totalLiabilities')).toBeInTheDocument();
    expect(screen.getByText('overview.budgetUsage')).toBeInTheDocument();
  });

  it('should render accounts and transactions sections', () => {
    render(<DashboardPage />);

    expect(screen.getByText('overview.accountsTitle')).toBeInTheDocument();
    expect(screen.getByText('overview.recentTransactions')).toBeInTheDocument();
  });

  it('should render sync status', () => {
    render(<DashboardPage />);

    expect(screen.getByTestId('sync-status')).toBeInTheDocument();
  });

  it('should show loading skeleton when spaces are still loading', () => {
    mockUseSpaces = () => ({ data: undefined, isLoading: true });
    mockUseSpaceStore = () => ({ currentSpace: null });

    render(<DashboardPage />);

    // Should show skeletons, not the empty state "Get Started" CTA
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    expect(screen.queryByText('emptyState.getStarted')).not.toBeInTheDocument();
  });

  it('should show empty state when spaces loaded but none exist', () => {
    mockUseSpaces = () => ({ data: [], isLoading: false });
    mockUseSpaceStore = () => ({ currentSpace: null });

    render(<DashboardPage />);

    expect(screen.getByText('emptyState.getStarted')).toBeInTheDocument();
  });
});
