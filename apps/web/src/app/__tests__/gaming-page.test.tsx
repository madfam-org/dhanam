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
  useTranslation: () => ({
    t: (key: string, params?: any) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
  Currency: { USD: 'USD' },
  CHART_COLORS: Array.from({ length: 16 }, (_, i) => `#${i.toString(16).padStart(6, '0')}`),
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => (
            <span data-testid={`icon-${String(prop).toLowerCase()}`} {...props} />
          );
        },
      }
    )
);

const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

const mockUseAuth = jest.fn();
jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/stores/space', () => ({
  useSpaceStore: () => ({ currentSpace: { id: 'space-123' } }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number, currency: string) => `$${amount.toFixed(2)}`,
}));

jest.mock('@/components/gaming/platform-selector', () => ({
  PlatformSelector: (props: any) => <div data-testid="platform-selector" />,
}));

jest.mock('@/components/gaming/multi-platform-overview', () => ({
  MultiPlatformOverview: (props: any) => <div data-testid="multi-platform-overview" />,
}));

jest.mock('@/components/gaming/earnings-by-platform', () => ({
  EarningsByPlatform: (props: any) => <div data-testid="earnings-by-platform" />,
}));

jest.mock('@/components/gaming/guild-tracker', () => ({
  GuildTracker: (props: any) => <div data-testid="guild-tracker" />,
}));

jest.mock('@/components/gaming/cross-chain-view', () => ({
  CrossChainView: (props: any) => <div data-testid="cross-chain-view" />,
}));

jest.mock('@/components/gaming/land-portfolio', () => ({
  LandPortfolio: (props: any) => <div data-testid="land-portfolio" />,
}));

jest.mock('@/components/gaming/nft-gallery', () => ({
  NftGallery: (props: any) => <div data-testid="nft-gallery" />,
}));

jest.mock('@/components/gaming/governance-activity', () => ({
  GovernanceActivity: (props: any) => <div data-testid="governance-activity" />,
}));

jest.mock('@/lib/api/gaming', () => ({
  gamingApi: { getPortfolio: jest.fn() },
}));

import GamingPage from '../(dashboard)/gaming/page';

describe('GamingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'diego@dhanam.demo' },
    });
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('API not available'),
    });
  });

  it('should render the page title', () => {
    render(<GamingPage />);
    expect(screen.getByText('page.title')).toBeInTheDocument();
  });

  it('should render gaming components with fallback data when API fails', () => {
    render(<GamingPage />);
    expect(screen.getByTestId('platform-selector')).toBeInTheDocument();
    expect(screen.getByTestId('multi-platform-overview')).toBeInTheDocument();
    expect(screen.getByTestId('earnings-by-platform')).toBeInTheDocument();
    expect(screen.getByTestId('guild-tracker')).toBeInTheDocument();
    expect(screen.getByTestId('cross-chain-view')).toBeInTheDocument();
    expect(screen.getByTestId('land-portfolio')).toBeInTheDocument();
    expect(screen.getByTestId('nft-gallery')).toBeInTheDocument();
    expect(screen.getByTestId('governance-activity')).toBeInTheDocument();
  });

  it('should show connect CTA for non-gaming persona users', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-2', email: 'test@example.com' },
    });
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    render(<GamingPage />);
    expect(screen.getByText('Connect Your Gaming Accounts')).toBeInTheDocument();
    expect(screen.getByText('Connect Gaming Wallet')).toBeInTheDocument();
  });

  it('should show loading skeletons when data is loading', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<GamingPage />);
    expect(screen.getByText('page.loading')).toBeInTheDocument();
  });
});
