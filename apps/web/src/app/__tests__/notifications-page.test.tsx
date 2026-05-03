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
  useQuery: () => ({ data: [], isLoading: false }),
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

import NotificationsPage from '../(dashboard)/notifications/page';

describe('NotificationsPage', () => {
  it('should render the page title', () => {
    render(<NotificationsPage />);
    expect(screen.getByText('notifications')).toBeInTheDocument();
  });

  it('should render tab navigation', () => {
    render(<NotificationsPage />);
    expect(screen.getByText('all')).toBeInTheDocument();
    expect(screen.getByText('alerts')).toBeInTheDocument();
    expect(screen.getByText('insights')).toBeInTheDocument();
    expect(screen.getByText('reminders')).toBeInTheDocument();
  });

  it('should show all caught up message when no unread notifications', () => {
    render(<NotificationsPage />);
    expect(screen.getByText('allCaughtUp')).toBeInTheDocument();
  });

  it('should show no notifications message for empty tabs', () => {
    render(<NotificationsPage />);
    // Multiple tabs show 'noNotifications' for empty content
    const noNotifications = screen.getAllByText('noNotifications');
    expect(noNotifications.length).toBeGreaterThan(0);
  });
});
