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

// Local UI mocks
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

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

jest.mock('@/hooks/useHouseholds', () => ({
  useHouseholds: () => ({
    getHouseholds: jest.fn().mockResolvedValue([]),
    getHousehold: jest.fn(),
    createHousehold: jest.fn(),
    getHouseholdNetWorth: jest.fn(),
    getHouseholdGoalSummary: jest.fn(),
    loading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/useOwnershipNetWorth', () => ({
  useOwnershipNetWorth: () => ({
    netWorth: null,
    accounts: [],
    loading: false,
    fetchNetWorthByOwnership: jest.fn(),
    fetchAccountsByOwnership: jest.fn(),
  }),
}));

jest.mock('@/components/accounts/ownership-toggle', () => ({
  OwnershipToggle: () => <div data-testid="ownership-toggle" />,
}));

import HouseholdsPage from '../(dashboard)/households/page';

describe('HouseholdsPage', () => {
  it('should render the page title', () => {
    render(<HouseholdsPage />);
    expect(screen.getByText('page.title')).toBeInTheDocument();
  });

  it('should render the page description', () => {
    render(<HouseholdsPage />);
    expect(screen.getByText('page.description')).toBeInTheDocument();
  });

  it('should render create household button', () => {
    render(<HouseholdsPage />);
    const buttons = screen.getAllByText('page.createHousehold');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no households exist', async () => {
    render(<HouseholdsPage />);
    const emptyTitle = await screen.findByText('empty.title');
    expect(emptyTitle).toBeInTheDocument();
  });

  it('should render the content area', () => {
    render(<HouseholdsPage />);
    // The page renders even with empty households
    expect(screen.getByText('page.title')).toBeInTheDocument();
    expect(screen.getByText('page.description')).toBeInTheDocument();
  });
});
