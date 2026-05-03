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

jest.mock('@/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
  }),
}));

jest.mock('@/lib/api/reports', () => ({
  reportsApi: {
    getAvailableReports: jest.fn(),
    getSavedReports: jest.fn(),
    getSharedWithMe: jest.fn(),
    downloadPdfReport: jest.fn(),
    downloadCsvExport: jest.fn(),
    downloadExcelExport: jest.fn(),
    downloadJsonExport: jest.fn(),
    createSavedReport: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Local UI components used in reports page via @/components/ui/dialog
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

jest.mock('@/components/reports/saved-report-card', () => ({
  SavedReportCard: () => <div data-testid="saved-report-card" />,
}));

jest.mock('@/components/reports/share-report-dialog', () => ({
  ShareReportDialog: () => <div data-testid="share-report-dialog" />,
}));

jest.mock('@/components/reports/share-management-panel', () => ({
  ShareManagementPanel: () => <div data-testid="share-management-panel" />,
}));

jest.mock('@/components/reports/share-link-panel', () => ({
  ShareLinkPanel: () => <div data-testid="share-link-panel" />,
}));

jest.mock('@/components/reports/report-history-panel', () => ({
  ReportHistoryPanel: () => <div data-testid="report-history-panel" />,
}));

import ReportsPage from '../(dashboard)/reports/page';

describe('ReportsPage', () => {
  it('should render the page title', () => {
    render(<ReportsPage />);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('should render quick export section', () => {
    render(<ReportsPage />);
    expect(screen.getByText('quickExport.title')).toBeInTheDocument();
  });

  it('should render report templates section', () => {
    render(<ReportsPage />);
    expect(screen.getByText('templates.heading')).toBeInTheDocument();
  });

  it('should render custom report generator', () => {
    render(<ReportsPage />);
    expect(screen.getByText('custom.title')).toBeInTheDocument();
  });
});
