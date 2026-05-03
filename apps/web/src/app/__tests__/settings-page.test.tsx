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

let mockQueryData: any = {
  emailNotifications: true,
  transactionAlerts: true,
  budgetAlerts: true,
  weeklyReports: false,
  securityAlerts: true,
  analyticsTracking: true,
  hideSensitiveData: false,
  themeMode: 'system',
  compactView: false,
  showBalances: true,
  defaultCurrency: 'USD',
  autoCategorizeTxns: true,
  esgScoreVisibility: true,
  sustainabilityAlerts: false,
  impactReporting: false,
  autoBackup: true,
  exportFormat: 'csv',
};
let mockQueryLoading = false;
let mockQueryError: Error | null = null;

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => {
    if (queryKey[0] === 'preferences') {
      return { data: mockQueryData, isLoading: mockQueryLoading, error: mockQueryError };
    }
    return { data: null, isLoading: false, error: null };
  },
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

jest.mock('@/lib/api/preferences', () => ({
  preferencesApi: {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
    resetPreferences: jest.fn(),
  },
  UserPreferences: {},
}));

jest.mock('@/lib/api/billing', () => ({
  billingApi: {
    getStatus: jest.fn(),
    getHistory: jest.fn(),
    createPortalSession: jest.fn(),
  },
}));

jest.mock('~/components/billing/UsageIndicator', () => ({
  UsageOverview: () => <div data-testid="usage-overview" />,
}));

jest.mock('~/components/billing/PremiumUpsell', () => ({
  PremiumUpsell: () => <div data-testid="premium-upsell" />,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import SettingsPage from '../(dashboard)/settings/page';

describe('SettingsPage', () => {
  beforeEach(() => {
    mockQueryData = {
      emailNotifications: true,
      transactionAlerts: true,
      budgetAlerts: true,
      weeklyReports: false,
      securityAlerts: true,
      analyticsTracking: true,
      hideSensitiveData: false,
      themeMode: 'system',
      compactView: false,
      showBalances: true,
      defaultCurrency: 'USD',
      autoCategorizeTxns: true,
      esgScoreVisibility: true,
      sustainabilityAlerts: false,
      impactReporting: false,
      autoBackup: true,
      exportFormat: 'csv',
    };
    mockQueryLoading = false;
    mockQueryError = null;
  });

  it('should render the page title', () => {
    render(<SettingsPage />);
    expect(screen.getByText('page.title')).toBeInTheDocument();
  });

  it('should show loading state when preferences are loading', () => {
    mockQueryLoading = true;
    mockQueryData = undefined;
    render(<SettingsPage />);
    expect(screen.getByTestId('icon-Loader2')).toBeInTheDocument();
  });

  it('should show error state when preferences fail to load', () => {
    mockQueryError = new Error('Network error');
    mockQueryData = undefined;
    render(<SettingsPage />);
    expect(screen.getByText('error.loadFailed')).toBeInTheDocument();
  });

  it('should render notification section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('section.notifications.title')).toBeInTheDocument();
  });

  it('should render privacy section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('section.privacy.title')).toBeInTheDocument();
  });

  it('should render display section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('section.display.title')).toBeInTheDocument();
  });
});
