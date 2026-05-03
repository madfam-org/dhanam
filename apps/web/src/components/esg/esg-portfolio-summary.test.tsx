import { render, screen } from '@testing-library/react';
import React from 'react';

import type { PortfolioEsgAnalysis } from '@/hooks/useEsg';

import { EsgPortfolioSummary } from './esg-portfolio-summary';

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

const mockAnalysis: PortfolioEsgAnalysis = {
  overallScore: 72,
  grade: 'B+',
  breakdown: {
    environmental: 65,
    social: 78,
    governance: 75,
  },
  holdings: [],
  insights: [],
  analysisDate: '2025-01-20T12:00:00Z',
  methodology: 'Dhanam Framework v2.0',
};

describe('EsgPortfolioSummary', () => {
  it('should render the portfolio ESG score card', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText('Portfolio ESG Score')).toBeInTheDocument();
    expect(screen.getByText(/Environmental, Social, and Governance analysis/)).toBeInTheDocument();
  });

  it('should display the overall score', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Overall ESG Score (0-100)')).toBeInTheDocument();
  });

  it('should display the grade badge', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText('B+')).toBeInTheDocument();
  });

  it('should display environmental score', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText('Environmental')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
  });

  it('should display social score', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('should display governance score', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText('Governance')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('should display methodology', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText(/Methodology: Dhanam Framework v2.0/)).toBeInTheDocument();
  });

  it('should apply correct grade color for A grades', () => {
    const aGradeAnalysis = { ...mockAnalysis, grade: 'A+' };
    render(<EsgPortfolioSummary analysis={aGradeAnalysis} />);

    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-green-600');
  });

  it('should apply correct grade color for B grades', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-blue-600');
  });

  it('should apply correct grade color for C grades', () => {
    const cGradeAnalysis = { ...mockAnalysis, grade: 'C' };
    render(<EsgPortfolioSummary analysis={cGradeAnalysis} />);

    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-yellow-600');
  });

  it('should apply correct grade color for D/F grades', () => {
    const dGradeAnalysis = { ...mockAnalysis, grade: 'D' };
    render(<EsgPortfolioSummary analysis={dGradeAnalysis} />);

    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-red-600');
  });

  it('should render progress bars for all scores', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars.length).toBeGreaterThanOrEqual(4); // Overall + E + S + G
  });

  it('should apply correct score color for excellent scores', () => {
    const excellentAnalysis = { ...mockAnalysis, overallScore: 90 };
    render(<EsgPortfolioSummary analysis={excellentAnalysis} />);

    expect(screen.getByText('90').className).toContain('text-green-600');
  });

  it('should apply correct score color for good scores', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    // 72 is in the blue range (70-84)
    expect(screen.getByText('72').className).toContain('text-blue-600');
  });

  it('should apply correct score color for fair scores', () => {
    const fairAnalysis = { ...mockAnalysis, overallScore: 60 };
    render(<EsgPortfolioSummary analysis={fairAnalysis} />);

    expect(screen.getByText('60').className).toContain('text-yellow-600');
  });

  it('should apply correct score color for poor scores', () => {
    const poorAnalysis = { ...mockAnalysis, overallScore: 40 };
    render(<EsgPortfolioSummary analysis={poorAnalysis} />);

    expect(screen.getByText('40').className).toContain('text-red-600');
  });

  it('should display analysis date', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText(/Analysis Date:/)).toBeInTheDocument();
  });

  it('should show descriptions for each ESG category', () => {
    render(<EsgPortfolioSummary analysis={mockAnalysis} />);

    expect(screen.getByText(/Energy efficiency, carbon footprint/)).toBeInTheDocument();
    expect(screen.getByText(/Financial inclusion, accessibility/)).toBeInTheDocument();
    expect(screen.getByText(/Decentralization, transparency/)).toBeInTheDocument();
  });
});
