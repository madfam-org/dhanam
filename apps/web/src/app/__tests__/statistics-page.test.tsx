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

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/test',
}));

jest.mock('~/lib/api/analytics', () => ({
  analyticsApi: {
    getStatistics: jest.fn(),
    getAnnualTrends: jest.fn(),
    getCalendarData: jest.fn(),
    executeQuery: jest.fn(),
  },
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number, currency: string) => `$${amount.toFixed(2)}`,
  formatDate: (date: any) => String(date),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

import StatisticsPage from '../(dashboard)/analytics/statistics/page';

describe('StatisticsPage', () => {
  it('should render the Statistics heading', () => {
    render(<StatisticsPage />);
    expect(screen.getByText('Statistics')).toBeInTheDocument();
  });
});
