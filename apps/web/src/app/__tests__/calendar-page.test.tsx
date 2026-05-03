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
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
  Currency: { USD: 'USD', MXN: 'MXN' },
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

const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

let mockSpace: any = { id: 'space-1', name: 'Personal', currency: 'USD' };
jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({ currentSpace: mockSpace }),
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
    getCalendarData: jest.fn(),
  },
}));

jest.mock('~/lib/utils', () => ({
  formatCurrency: (amount: number) => `$${amount?.toFixed?.(2) ?? '0.00'}`,
  formatDate: (date: any) => String(date),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('~/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('~/components/calendar', () => ({
  CalendarGrid: (props: any) => <div data-testid="calendar-grid" />,
  CalendarSkeleton: () => <div data-testid="calendar-skeleton" />,
  DayDetailPanel: (props: any) => <div data-testid="day-detail-panel" />,
  DayDetailSheet: (props: any) => <div data-testid="day-detail-sheet" />,
  MonthNavigator: (props: any) => <div data-testid="month-navigator" />,
  MonthlySummary: (props: any) => <div data-testid="monthly-summary" />,
}));

import CalendarPage from '../(dashboard)/transactions/calendar/page';

describe('CalendarPage', () => {
  beforeEach(() => {
    mockSpace = { id: 'space-1', name: 'Personal', currency: 'USD' };
    mockUseQuery.mockReturnValue({
      data: {
        year: 2026,
        month: 4,
        days: [
          { date: '2026-04-15', transactionCount: 3, income: 500, expenses: 200, net: 300 },
          { date: '2026-04-16', transactionCount: 1, income: 0, expenses: 50, net: -50 },
        ],
      },
      isLoading: false,
    });
  });

  it('should render the calendar title', () => {
    render(<CalendarPage />);
    expect(screen.getByText('calendar.title')).toBeInTheDocument();
  });

  it('should render the calendar description', () => {
    render(<CalendarPage />);
    expect(screen.getByText('calendar.description')).toBeInTheDocument();
  });

  it('should render calendar grid when data is loaded', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  });

  it('should render month navigator', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('month-navigator')).toBeInTheDocument();
  });

  it('should render monthly summary when data has days', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('monthly-summary')).toBeInTheDocument();
  });

  it('should render day detail panel on desktop', () => {
    render(<CalendarPage />);
    expect(screen.getByTestId('day-detail-panel')).toBeInTheDocument();
  });

  it('should show skeleton during loading', () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });
    render(<CalendarPage />);
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
  });

  it('should show no-space message when space is not selected', () => {
    mockSpace = null;
    render(<CalendarPage />);
    expect(screen.getByText('calendar.noSpaceSelected')).toBeInTheDocument();
  });

  it('should not show monthly summary when no data', () => {
    mockUseQuery.mockReturnValue({
      data: { year: 2026, month: 4, days: [] },
      isLoading: false,
    });
    render(<CalendarPage />);
    expect(screen.queryByTestId('monthly-summary')).not.toBeInTheDocument();
  });
});
