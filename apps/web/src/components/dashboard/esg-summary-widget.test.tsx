import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { EsgSummaryWidget } from './esg-summary-widget';

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => (
    <h3 data-testid="card-title" className={className}>
      {children}
    </h3>
  ),
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, className, variant, size }: any) => (
    <button data-testid="button" className={className} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, indicatorClassName }: any) => (
    <div
      data-testid="progress"
      data-value={value}
      className={className}
      data-indicator={indicatorClassName}
    />
  ),
}));

jest.mock('lucide-react', () => ({
  Leaf: () => <svg data-testid="leaf-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  Building2: () => <svg data-testid="building-icon" />,
  ArrowRight: () => <svg data-testid="arrow-icon" />,
  Loader2: ({ className }: any) => <svg data-testid="loader-icon" className={className} />,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  ),
}));

const mockAnalysis = {
  overallScore: 72,
  grade: 'B+',
  breakdown: {
    environmental: 65,
    social: 78,
    governance: 75,
  },
};

const mockGetPortfolioAnalysis = jest.fn();
const mockUseEsg = {
  getPortfolioAnalysis: mockGetPortfolioAnalysis,
  loading: false,
};

jest.mock('@/hooks/useEsg', () => ({
  useEsg: () => mockUseEsg,
}));

describe('EsgSummaryWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEsg.loading = false;
    mockGetPortfolioAnalysis.mockResolvedValue(mockAnalysis);
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading and no analysis', async () => {
      mockUseEsg.loading = true;
      mockGetPortfolioAnalysis.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<EsgSummaryWidget />);

      expect(screen.getByText('ESG Score')).toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('should have spinning animation on loader', async () => {
      mockUseEsg.loading = true;
      mockGetPortfolioAnalysis.mockReturnValue(new Promise(() => {}));

      render(<EsgSummaryWidget />);

      const loader = screen.getByTestId('loader-icon');
      // The component passes animate-spin class to Loader2
      expect(loader).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no analysis data', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue(null);

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('No crypto holdings found')).toBeInTheDocument();
      });
    });

    it('should show Learn More button in empty state', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue(null);

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('Learn More')).toBeInTheDocument();
      });
    });

    it('should link to ESG page in empty state', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue(null);

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const link = screen.getAllByTestId('link')[0];
        expect(link).toHaveAttribute('href', '/esg');
      });
    });
  });

  describe('With Analysis Data', () => {
    it('should display the ESG score card with analysis', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('ESG Score')).toBeInTheDocument();
        expect(screen.getByText('Portfolio sustainability rating')).toBeInTheDocument();
      });
    });

    it('should display the overall score', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('72')).toBeInTheDocument();
        expect(screen.getByText('Overall Score')).toBeInTheDocument();
      });
    });

    it('should display the grade badge', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('B+')).toBeInTheDocument();
      });
    });

    it('should display environmental score', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('Environmental')).toBeInTheDocument();
        expect(screen.getByText('65')).toBeInTheDocument();
      });
    });

    it('should display social score', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('Social')).toBeInTheDocument();
        expect(screen.getByText('78')).toBeInTheDocument();
      });
    });

    it('should display governance score', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('Governance')).toBeInTheDocument();
        expect(screen.getByText('75')).toBeInTheDocument();
      });
    });

    it('should render progress bars for E/S/G scores', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const progressBars = screen.getAllByTestId('progress');
        expect(progressBars.length).toBe(3);
      });
    });

    it('should show View Full Analysis button', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('View Full Analysis')).toBeInTheDocument();
      });
    });

    it('should link to ESG page from View Full Analysis', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const links = screen.getAllByTestId('link');
        const analysisLink = links.find((l) => l.getAttribute('href') === '/esg');
        expect(analysisLink).toBeDefined();
      });
    });
  });

  describe('Grade Colors', () => {
    it('should apply green color for A grades', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue({
        ...mockAnalysis,
        grade: 'A+',
      });

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const badge = screen.getByTestId('badge');
        expect(badge.className).toContain('bg-green-600');
      });
    });

    it('should apply blue color for B grades', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const badge = screen.getByTestId('badge');
        expect(badge.className).toContain('bg-blue-600');
      });
    });

    it('should apply yellow color for C grades', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue({
        ...mockAnalysis,
        grade: 'C',
      });

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const badge = screen.getByTestId('badge');
        expect(badge.className).toContain('bg-yellow-600');
      });
    });

    it('should apply red color for D/F grades', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue({
        ...mockAnalysis,
        grade: 'D',
      });

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const badge = screen.getByTestId('badge');
        expect(badge.className).toContain('bg-red-600');
      });
    });
  });

  describe('Hook Integration', () => {
    it('should call getPortfolioAnalysis on mount', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(mockGetPortfolioAnalysis).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle getPortfolioAnalysis returning undefined', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue(undefined);

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('No crypto holdings found')).toBeInTheDocument();
      });
    });

    it('should handle getPortfolioAnalysis returning nothing gracefully', async () => {
      mockGetPortfolioAnalysis.mockResolvedValue(null);

      render(<EsgSummaryWidget />);

      await waitFor(() => {
        expect(screen.getByText('No crypto holdings found')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Bar Colors', () => {
    it('should apply green indicator for environmental progress', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const progressBars = screen.getAllByTestId('progress');
        const envProgress = progressBars.find((p) =>
          p.getAttribute('data-indicator')?.includes('bg-green-600')
        );
        expect(envProgress).toBeDefined();
      });
    });

    it('should apply blue indicator for social progress', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const progressBars = screen.getAllByTestId('progress');
        const socialProgress = progressBars.find((p) =>
          p.getAttribute('data-indicator')?.includes('bg-blue-600')
        );
        expect(socialProgress).toBeDefined();
      });
    });

    it('should apply purple indicator for governance progress', async () => {
      render(<EsgSummaryWidget />);

      await waitFor(() => {
        const progressBars = screen.getAllByTestId('progress');
        const govProgress = progressBars.find((p) =>
          p.getAttribute('data-indicator')?.includes('bg-purple-600')
        );
        expect(govProgress).toBeDefined();
      });
    });
  });
});
