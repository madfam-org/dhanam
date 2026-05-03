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
  useQueryClient: () => ({ invalidateQueries: jest.fn(), clear: jest.fn() }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: Object.assign(
    () => ({
      currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
    }),
    {
      getState: () => ({
        setCurrentSpace: jest.fn(),
        setSpaces: jest.fn(),
      }),
    }
  ),
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

jest.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    track: jest.fn(),
    trackPageView: jest.fn(),
    trackViewNetWorth: jest.fn(),
    trackUpgradeCompleted: jest.fn(),
  }),
}));

// Local UI mocks for demo page which uses @/components/ui/*
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

jest.mock('~/lib/api/auth', () => ({
  authApi: {
    loginAsPersona: jest.fn().mockResolvedValue({
      user: { id: 'demo-1', name: 'Demo User' },
      tokens: { accessToken: 'token', refreshToken: 'refresh' },
    }),
  },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue(null),
  }),
}));

import DemoPage from '../demo/page';

describe('DemoPage', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('should render "Experience Dhanam" heading', () => {
    render(<DemoPage />);
    expect(screen.getByText('Experience Dhanam')).toBeInTheDocument();
  });

  it('should render persona cards', () => {
    render(<DemoPage />);
    expect(screen.getByText('Maria Gonz\u00e1lez')).toBeInTheDocument();
    expect(screen.getByText('Carlos Mendoza')).toBeInTheDocument();
    expect(screen.getByText('Patricia Ruiz')).toBeInTheDocument();
    expect(screen.getByText('Diego Navarro')).toBeInTheDocument();
    expect(screen.getByText('Quick Preview')).toBeInTheDocument();
  });

  it('should show sign up button', () => {
    render(<DemoPage />);
    expect(screen.getByText('Sign Up for Full Access')).toBeInTheDocument();
  });
});
