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

jest.mock('~/components/billing/PremiumGate', () => ({
  PremiumGate: ({ children }: any) => <div data-testid="premium-gate">{children}</div>,
}));

jest.mock('@/components/simulations/RetirementCalculatorForm', () => ({
  RetirementCalculatorForm: () => <div data-testid="retirement-calculator-form" />,
}));

jest.mock('@/components/simulations/RetirementResults', () => ({
  RetirementResults: () => <div data-testid="retirement-results" />,
}));

jest.mock('@/components/simulations/SimulationChart', () => ({
  SimulationChart: () => <div data-testid="simulation-chart" />,
}));

jest.mock('@/hooks/useSimulations', () => ({
  __esModule: true,
}));

// Local UI mocks
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
  AlertTitle: ({ children }: any) => <div>{children}</div>,
}));

import RetirementPage from '../(dashboard)/retirement/page';

describe('RetirementPage', () => {
  it('should render the page title', () => {
    render(<RetirementPage />);
    expect(screen.getByText('main.retirementPlanning')).toBeInTheDocument();
  });

  it('should render within PremiumGate', () => {
    render(<RetirementPage />);
    expect(screen.getByTestId('premium-gate')).toBeInTheDocument();
  });

  it('should render the retirement calculator form', () => {
    render(<RetirementPage />);
    expect(screen.getByTestId('retirement-calculator-form')).toBeInTheDocument();
  });

  it('should show empty state when no results', () => {
    render(<RetirementPage />);
    expect(screen.getByText('retirement.noProjectionYet')).toBeInTheDocument();
  });

  it('should render educational content section', () => {
    render(<RetirementPage />);
    expect(screen.getByText('retirement.understandingResults')).toBeInTheDocument();
    expect(screen.getByText('retirement.successRate')).toBeInTheDocument();
    expect(screen.getByText('retirement.percentiles')).toBeInTheDocument();
    expect(screen.getByText('retirement.safeWithdrawalRate')).toBeInTheDocument();
  });
});
