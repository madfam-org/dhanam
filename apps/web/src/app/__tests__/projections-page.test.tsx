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
  useSpaceStore: (selector?: any) => {
    const state = {
      currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
    };
    return selector ? selector(state) : state;
  },
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

// Local UI mocks
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: (props: any) => <div data-testid="slider" />,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
  AlertTitle: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/projections/long-term-chart', () => ({
  LongTermChart: () => <div data-testid="long-term-chart" />,
  IncomeExpenseChart: () => <div data-testid="income-expense-chart" />,
}));

jest.mock('@/components/projections/life-event-timeline', () => ({
  LifeEventTimeline: () => <div data-testid="life-event-timeline" />,
}));

jest.mock('@/components/projections/what-if-panel', () => ({
  WhatIfPanel: () => <div data-testid="what-if-panel" />,
}));

jest.mock('@/lib/api/projections', () => ({
  projectionsApi: {
    generateProjection: jest.fn(),
    compareScenarios: jest.fn(),
    getScenarioTemplates: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/stores/space', () => ({
  useSpaceStore: (selector?: any) => {
    const state = {
      currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
    };
    return selector ? selector(state) : state;
  },
}));

import ProjectionsPage from '../(dashboard)/projections/page';

describe('ProjectionsPage', () => {
  it('should render the page title', () => {
    render(<ProjectionsPage />);
    expect(screen.getByText('page.longTermProjections')).toBeInTheDocument();
  });

  it('should render within PremiumGate', () => {
    render(<ProjectionsPage />);
    expect(screen.getByTestId('premium-gate')).toBeInTheDocument();
  });

  it('should render projection settings form', () => {
    render(<ProjectionsPage />);
    expect(screen.getByText('page.projectionSettings')).toBeInTheDocument();
  });

  it('should show no projection empty state', () => {
    render(<ProjectionsPage />);
    expect(screen.getByText('page.noProjection')).toBeInTheDocument();
  });

  it('should render generate projection button', () => {
    render(<ProjectionsPage />);
    const buttons = screen.getAllByText('page.generateProjection');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
