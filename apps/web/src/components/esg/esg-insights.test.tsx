import { render, screen } from '@testing-library/react';
import React from 'react';

import type { PortfolioEsgAnalysis, EsgTrends } from '@/hooks/useEsg';

import { EsgInsights } from './esg-insights';

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

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, variant, className }: any) => (
    <div data-testid="alert" data-variant={variant} className={className}>
      {children}
    </div>
  ),
  AlertDescription: ({ children, className }: any) => (
    <span data-testid="alert-description" className={className}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, variant }: any) => (
    <span data-testid="badge" className={className} data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock('lucide-react', () => ({
  Lightbulb: () => <svg data-testid="lightbulb-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  TrendingDown: () => <svg data-testid="trending-down-icon" />,
  AlertCircle: () => <svg data-testid="alert-circle-icon" />,
  CheckCircle2: () => <svg data-testid="check-circle-icon" />,
  Info: () => <svg data-testid="info-icon" />,
}));

const mockAnalysis: PortfolioEsgAnalysis = {
  overallScore: 72,
  grade: 'B+',
  breakdown: {
    environmental: 65,
    social: 78,
    governance: 75,
  },
  holdings: [],
  insights: [
    'Your portfolio has excellent governance scores',
    'Consider diversifying into more sustainable assets',
    'High environmental impact detected in some holdings',
  ],
  analysisDate: '2025-01-20T12:00:00Z',
  methodology: 'Dhanam Framework v2.0',
};

const mockTrends: EsgTrends = {
  trending: {
    improving: ['ETH', 'ADA', 'DOT'],
    declining: ['BTC', 'XRP'],
  },
  marketInsights: [
    'Proof-of-Stake assets showing improved scores',
    'Regulatory pressure improving governance metrics',
  ],
  recommendations: [
    'Consider ETH for its strong ESG trajectory',
    'ADA offers excellent environmental scores',
  ],
};

describe('EsgInsights', () => {
  describe('Portfolio Insights', () => {
    it('should render the portfolio insights card', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      expect(screen.getByText('Portfolio Insights')).toBeInTheDocument();
      expect(
        screen.getByText('Personalized recommendations based on your holdings')
      ).toBeInTheDocument();
    });

    it('should display all insights', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      expect(
        screen.getByText('Your portfolio has excellent governance scores')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Consider diversifying into more sustainable assets')
      ).toBeInTheDocument();
      expect(
        screen.getByText('High environmental impact detected in some holdings')
      ).toBeInTheDocument();
    });

    it('should show empty state when no insights', () => {
      const emptyAnalysis = { ...mockAnalysis, insights: [] };
      render(<EsgInsights analysis={emptyAnalysis} />);

      expect(screen.getByText('No insights available')).toBeInTheDocument();
    });

    it('should apply check icon for excellent/strong insights', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      // The "excellent governance scores" insight should have a check icon
      expect(screen.getAllByTestId('check-circle-icon').length).toBeGreaterThan(0);
    });

    it('should apply info icon for consider/diversify insights', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      // The "Consider diversifying" insight should have an info icon
      expect(screen.getAllByTestId('info-icon').length).toBeGreaterThan(0);
    });

    it('should apply alert icon for high impact warnings', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      // The "High impact" insight should have an alert icon
      expect(screen.getAllByTestId('alert-circle-icon').length).toBeGreaterThan(0);
    });

    it('should apply destructive variant for high impact alerts', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      const alerts = screen.getAllByTestId('alert');
      const destructiveAlert = alerts.find((a) => a.getAttribute('data-variant') === 'destructive');
      expect(destructiveAlert).toBeDefined();
    });
  });

  describe('Market Trends', () => {
    it('should render the market trends card when trends provided', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      expect(screen.getByText('ESG Market Trends')).toBeInTheDocument();
      expect(
        screen.getByText('Current trends in cryptocurrency ESG performance')
      ).toBeInTheDocument();
    });

    it('should not render market trends when trends not provided', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      expect(screen.queryByText('ESG Market Trends')).not.toBeInTheDocument();
    });

    it('should display improving assets', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      expect(screen.getByText('Improving ESG Performance')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('ADA')).toBeInTheDocument();
      expect(screen.getByText('DOT')).toBeInTheDocument();
    });

    it('should display declining assets', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      expect(screen.getByText('Declining ESG Performance')).toBeInTheDocument();
      expect(screen.getByText('BTC')).toBeInTheDocument();
      expect(screen.getByText('XRP')).toBeInTheDocument();
    });

    it('should apply green badge for improving assets', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      const badges = screen.getAllByTestId('badge');
      const greenBadges = badges.filter((b) => b.className?.includes('bg-green-600'));
      expect(greenBadges.length).toBe(3); // ETH, ADA, DOT
    });

    it('should apply destructive variant for declining assets', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      const badges = screen.getAllByTestId('badge');
      const destructiveBadges = badges.filter(
        (b) => b.getAttribute('data-variant') === 'destructive'
      );
      expect(destructiveBadges.length).toBe(2); // BTC, XRP
    });

    it('should display market insights', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      expect(screen.getByText('Market Insights')).toBeInTheDocument();
      expect(screen.getByText('Proof-of-Stake assets showing improved scores')).toBeInTheDocument();
      expect(
        screen.getByText('Regulatory pressure improving governance metrics')
      ).toBeInTheDocument();
    });

    it('should not display improving section when empty', () => {
      const noImprovingTrends = {
        ...mockTrends,
        trending: { ...mockTrends.trending, improving: [] },
      };
      render(<EsgInsights analysis={mockAnalysis} trends={noImprovingTrends} />);

      expect(screen.queryByText('Improving ESG Performance')).not.toBeInTheDocument();
    });

    it('should not display declining section when empty', () => {
      const noDecliningTrends = {
        ...mockTrends,
        trending: { ...mockTrends.trending, declining: [] },
      };
      render(<EsgInsights analysis={mockAnalysis} trends={noDecliningTrends} />);

      expect(screen.queryByText('Declining ESG Performance')).not.toBeInTheDocument();
    });
  });

  describe('Recommendations', () => {
    it('should render the recommendations card when available', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      expect(screen.getByText('ESG Recommendations')).toBeInTheDocument();
      expect(
        screen.getByText('Assets with strong ESG profiles worth considering')
      ).toBeInTheDocument();
    });

    it('should display all recommendations', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={mockTrends} />);

      expect(screen.getByText('Consider ETH for its strong ESG trajectory')).toBeInTheDocument();
      expect(screen.getByText('ADA offers excellent environmental scores')).toBeInTheDocument();
    });

    it('should not render recommendations when empty', () => {
      const noRecommendationsTrends = { ...mockTrends, recommendations: [] };
      render(<EsgInsights analysis={mockAnalysis} trends={noRecommendationsTrends} />);

      expect(screen.queryByText('ESG Recommendations')).not.toBeInTheDocument();
    });

    it('should not render recommendations when trends undefined', () => {
      render(<EsgInsights analysis={mockAnalysis} />);

      expect(screen.queryByText('ESG Recommendations')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle null trends gracefully', () => {
      render(<EsgInsights analysis={mockAnalysis} trends={null} />);

      expect(screen.getByText('Portfolio Insights')).toBeInTheDocument();
      expect(screen.queryByText('ESG Market Trends')).not.toBeInTheDocument();
    });

    it('should handle insights with strong keyword', () => {
      const strongAnalysis = {
        ...mockAnalysis,
        insights: ['Your portfolio shows strong social performance'],
      };
      render(<EsgInsights analysis={strongAnalysis} />);

      expect(screen.getAllByTestId('check-circle-icon').length).toBeGreaterThan(0);
    });

    it('should handle insights without specific keywords', () => {
      const genericAnalysis = {
        ...mockAnalysis,
        insights: ['General portfolio observation'],
      };
      render(<EsgInsights analysis={genericAnalysis} />);

      // Should fall back to lightbulb icon
      expect(screen.getAllByTestId('lightbulb-icon').length).toBeGreaterThan(0);
    });

    it('should handle undefined insights array', () => {
      const noInsightsAnalysis = {
        ...mockAnalysis,
        insights: undefined as unknown as string[],
      };
      render(<EsgInsights analysis={noInsightsAnalysis} />);

      expect(screen.getByText('No insights available')).toBeInTheDocument();
    });
  });
});
