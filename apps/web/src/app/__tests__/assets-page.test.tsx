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

// The assets page uses @/components/ui/* (local), not @dhanam/ui
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

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue([]),
    post: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('@/components/assets/manual-asset-form', () => ({
  ManualAssetForm: () => <div data-testid="manual-asset-form" />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

jest.mock('@/stores/space', () => ({
  useSpaceStore: (selector?: any) => {
    const state = {
      currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
    };
    return selector ? selector(state) : state;
  },
}));

import AssetsPage from '../(dashboard)/assets/page';

describe('AssetsPage', () => {
  it('should render the page title', async () => {
    render(<AssetsPage />);
    // Wait for useEffect / loading to finish
    const title = await screen.findByText('page.title');
    expect(title).toBeInTheDocument();
  });

  it('should render portfolio summary card', async () => {
    render(<AssetsPage />);
    const summary = await screen.findByText('page.portfolioSummary');
    expect(summary).toBeInTheDocument();
  });

  it('should show empty state with add button when no assets', async () => {
    render(<AssetsPage />);
    const emptyTitle = await screen.findByText('empty.title');
    expect(emptyTitle).toBeInTheDocument();
  });

  it('should render add asset button in header', async () => {
    render(<AssetsPage />);
    const addButton = await screen.findByText('page.addAsset');
    expect(addButton).toBeInTheDocument();
  });

  it('should render the portfolio description', async () => {
    render(<AssetsPage />);
    const desc = await screen.findByText('page.portfolioDescription');
    expect(desc).toBeInTheDocument();
  });
});
