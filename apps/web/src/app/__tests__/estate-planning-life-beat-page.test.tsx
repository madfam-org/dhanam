import { render, screen } from '@testing-library/react';
import React from 'react';

// This page uses @/components/ui/* (local shadcn), not @dhanam/ui
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h3>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      data-testid="switch"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <p>{children}</p>,
  AlertTitle: ({ children }: any) => <h4>{children}</h4>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h3>{children}</h3>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: React.forwardRef((props: any, ref: any) => <input ref={ref} {...props} />),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ ...props }: any) => <input type="checkbox" data-testid="checkbox" {...props} />,
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

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

const mockLifeBeatStatus = jest.fn();
const mockExecutorsQuery = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (opts: any) => {
    const key = opts?.queryKey?.[0] ?? '';
    if (key === 'life-beat-status') return mockLifeBeatStatus();
    if (key === 'executors') return mockExecutorsQuery();
    return { data: null, isLoading: false };
  },
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('@/lib/api/users', () => ({
  usersApi: {
    getLifeBeatStatus: jest.fn(),
    enableLifeBeat: jest.fn(),
    disableLifeBeat: jest.fn(),
    checkIn: jest.fn(),
  },
}));

jest.mock('@/lib/api/estate-planning', () => ({
  estatePlanningApi: {
    getExecutors: jest.fn(),
    addExecutor: jest.fn(),
    removeExecutor: jest.fn(),
  },
}));

import LifeBeatPage from '../(dashboard)/estate-planning/life-beat/page';

describe('LifeBeatPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLifeBeatStatus.mockReturnValue({
      data: {
        enabled: true,
        daysSinceActivity: 5,
        alertDays: [30, 60, 90],
        executorCount: 2,
        pendingAlerts: [],
      },
      isLoading: false,
    });
    mockExecutorsQuery.mockReturnValue({
      data: [
        {
          id: 'exec-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          relationship: 'spouse',
          verified: true,
          accessGranted: false,
        },
      ],
    });
  });

  it('should render the page title', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.title')).toBeInTheDocument();
  });

  it('should render the page description', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.description')).toBeInTheDocument();
  });

  it('should render the protection status card with switch', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.protectionStatus')).toBeInTheDocument();
    expect(screen.getByTestId('switch')).toBeInTheDocument();
  });

  it('should render the check-in button when enabled', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.checkIn')).toBeInTheDocument();
  });

  it('should render activity status metrics when enabled', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.lastActivity')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.alertThresholds')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.trustedExecutors')).toBeInTheDocument();
  });

  it('should render executors section', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.executors.title')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.executors.description')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('should render how-it-works section', () => {
    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.howItWorks.title')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.howItWorks.step1.title')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.howItWorks.step2.title')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.howItWorks.step3.title')).toBeInTheDocument();
  });

  it('should show disabled state when Life Beat is not enabled', () => {
    mockLifeBeatStatus.mockReturnValue({
      data: {
        enabled: false,
        daysSinceActivity: null,
        alertDays: [],
        executorCount: 0,
        pendingAlerts: [],
      },
      isLoading: false,
    });

    render(<LifeBeatPage />);
    expect(screen.getByText('lifeBeat.disabled.title')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.disabled.description')).toBeInTheDocument();
    expect(screen.getByText('lifeBeat.disabled.enable')).toBeInTheDocument();
  });

  it('should show loading spinner when data is loading', () => {
    mockLifeBeatStatus.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    mockExecutorsQuery.mockReturnValue({
      data: [],
    });

    render(<LifeBeatPage />);
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();
  });
});
