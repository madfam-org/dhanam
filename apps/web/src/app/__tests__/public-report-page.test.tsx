import { render, screen, act } from '@testing-library/react';
import React from 'react';

const mockParams = { token: 'abc-123' };

jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
}));

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

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <p>{children}</p>,
}));

jest.mock('lucide-react', () => ({
  Download: (props: any) => <span {...props} />,
  Loader2: (props: any) => <span data-testid="loader" {...props} />,
  FileText: (props: any) => <span {...props} />,
  AlertCircle: (props: any) => <span {...props} />,
}));

const mockGetPublicReport = jest.fn();

jest.mock('@/lib/api/reports', () => ({
  reportsApi: {
    getPublicReport: (...args: any[]) => mockGetPublicReport(...args),
  },
}));

import PublicReportPage from '../public/report/[token]/page';

describe('PublicReportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    mockGetPublicReport.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PublicReportPage />);
    expect(screen.getByText('Loading report...')).toBeInTheDocument();
  });

  it('should show error state when report fetch fails', async () => {
    mockGetPublicReport.mockRejectedValue(new Error('Link expired'));

    await act(async () => {
      render(<PublicReportPage />);
    });

    expect(screen.getByText('Report Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Link expired')).toBeInTheDocument();
  });

  it('should render report details on successful fetch', async () => {
    mockGetPublicReport.mockResolvedValue({
      reportName: 'Q4 Financial Summary',
      format: 'PDF',
      generatedAt: '2026-01-15T00:00:00Z',
      fileSize: 2048000,
      downloadUrl: 'https://example.com/report.pdf',
    });

    await act(async () => {
      render(<PublicReportPage />);
    });

    expect(screen.getByText('Q4 Financial Summary')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    expect(screen.getByText('Download Report')).toBeInTheDocument();
    expect(screen.getByText('Shared financial report')).toBeInTheDocument();
  });

  it('should call getPublicReport with the token from params', async () => {
    mockGetPublicReport.mockResolvedValue({
      reportName: 'Test Report',
      format: 'CSV',
      generatedAt: '2026-01-01T00:00:00Z',
      fileSize: 512,
      downloadUrl: 'https://example.com/report.csv',
    });

    await act(async () => {
      render(<PublicReportPage />);
    });

    expect(mockGetPublicReport).toHaveBeenCalledWith('abc-123');
  });
});
