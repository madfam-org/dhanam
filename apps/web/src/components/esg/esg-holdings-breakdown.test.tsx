import { render, screen } from '@testing-library/react';
import React from 'react';

import type { PortfolioEsgAnalysis } from '@/hooks/useEsg';

import { EsgHoldingsBreakdown } from './esg-holdings-breakdown';

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

jest.mock('lucide-react', () => ({
  Coins: () => <svg data-testid="coins-icon" />,
  Leaf: () => <svg data-testid="leaf-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  Building2: () => <svg data-testid="building-icon" />,
  Zap: () => <svg data-testid="zap-icon" />,
  Cloud: () => <svg data-testid="cloud-icon" />,
}));

const mockAnalysis: PortfolioEsgAnalysis = {
  overallScore: 72,
  grade: 'B+',
  breakdown: {
    environmental: 65,
    social: 78,
    governance: 75,
  },
  holdings: [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      weight: 0.6,
      value: 60000,
      esgScore: {
        overallScore: 45,
        grade: 'C',
        environmentalScore: 20,
        socialScore: 60,
        governanceScore: 55,
        energyIntensity: 1200,
        carbonFootprint: 500,
        consensusMechanism: 'Proof of Work',
        description: 'High energy consumption due to mining',
      },
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      weight: 0.3,
      value: 30000,
      esgScore: {
        overallScore: 75,
        grade: 'B+',
        environmentalScore: 70,
        socialScore: 78,
        governanceScore: 77,
        energyIntensity: 0.03,
        consensusMechanism: 'Proof of Stake',
      },
    },
    {
      symbol: 'ADA',
      name: 'Cardano',
      weight: 0.1,
      value: 10000,
      esgScore: {
        overallScore: 85,
        grade: 'A',
        environmentalScore: 90,
        socialScore: 82,
        governanceScore: 83,
      },
    },
  ],
  insights: [],
  analysisDate: '2025-01-20T12:00:00Z',
  methodology: 'Dhanam Framework v2.0',
};

describe('EsgHoldingsBreakdown', () => {
  it('should render the holdings ESG breakdown card', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('Holdings ESG Breakdown')).toBeInTheDocument();
    expect(
      screen.getByText('Individual ESG scores for each asset in your portfolio')
    ).toBeInTheDocument();
  });

  it('should display all holdings', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getAllByText('BTC').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ETH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ADA').length).toBeGreaterThanOrEqual(1);
  });

  it('should sort holdings by weight (highest first)', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    const badges = screen.getAllByTestId('badge');
    // BTC (60%) should come first with grade C
    expect(badges[0]).toHaveTextContent('C');
    // ETH (30%) second with grade B+
    expect(badges[1]).toHaveTextContent('B+');
    // ADA (10%) third with grade A
    expect(badges[2]).toHaveTextContent('A');
  });

  it('should display portfolio weight for each holding', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('60.0% of portfolio')).toBeInTheDocument();
    expect(screen.getByText('30.0% of portfolio')).toBeInTheDocument();
    expect(screen.getByText('10.0% of portfolio')).toBeInTheDocument();
  });

  it('should display overall ESG scores', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('45')).toBeInTheDocument(); // BTC
    expect(screen.getByText('75')).toBeInTheDocument(); // ETH
    expect(screen.getByText('85')).toBeInTheDocument(); // ADA
  });

  it('should display E/S/G component scores', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    // BTC scores
    expect(screen.getByText('E: 20')).toBeInTheDocument();
    expect(screen.getByText('S: 60')).toBeInTheDocument();
    expect(screen.getByText('G: 55')).toBeInTheDocument();
  });

  it('should render progress bars for each holding', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    const progressBars = screen.getAllByTestId('progress');
    // 3 holdings × 3 scores (E/S/G) = 9 progress bars
    expect(progressBars.length).toBe(9);
  });

  it('should display energy intensity when available', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('1.20K kWh/tx')).toBeInTheDocument(); // BTC
    expect(screen.getByText('0.03 kWh/tx')).toBeInTheDocument(); // ETH
  });

  it('should display carbon footprint when available', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('500.00 kg CO₂/tx')).toBeInTheDocument();
  });

  it('should display consensus mechanism when available', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('Proof of Work')).toBeInTheDocument();
    expect(screen.getByText('Proof of Stake')).toBeInTheDocument();
  });

  it('should display description when available', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getByText('High energy consumption due to mining')).toBeInTheDocument();
  });

  it('should apply correct grade color for A grades', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    const badges = screen.getAllByTestId('badge');
    // ADA has grade A
    expect(badges[2].className).toContain('bg-green-600');
  });

  it('should apply correct grade color for B grades', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    const badges = screen.getAllByTestId('badge');
    // ETH has grade B+
    expect(badges[1].className).toContain('bg-blue-600');
  });

  it('should apply correct grade color for C grades', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    const badges = screen.getAllByTestId('badge');
    // BTC has grade C
    expect(badges[0].className).toContain('bg-yellow-600');
  });

  it('should apply correct grade color for D/F grades', () => {
    const dGradeAnalysis: PortfolioEsgAnalysis = {
      ...mockAnalysis,
      holdings: [
        {
          symbol: 'LOW',
          name: 'Low Score Asset',
          weight: 1,
          value: 10000,
          esgScore: {
            overallScore: 25,
            grade: 'D',
            environmentalScore: 20,
            socialScore: 30,
            governanceScore: 25,
          },
        },
      ],
    };

    render(<EsgHoldingsBreakdown analysis={dGradeAnalysis} />);

    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('bg-red-600');
  });

  it('should show empty state when no holdings', () => {
    const emptyAnalysis: PortfolioEsgAnalysis = {
      ...mockAnalysis,
      holdings: [],
    };

    render(<EsgHoldingsBreakdown analysis={emptyAnalysis} />);

    expect(screen.getByText('No holdings to display')).toBeInTheDocument();
  });

  it('should format large numbers in millions', () => {
    const largeNumberAnalysis: PortfolioEsgAnalysis = {
      ...mockAnalysis,
      holdings: [
        {
          symbol: 'HIGH',
          name: 'High Energy',
          weight: 1,
          value: 10000,
          esgScore: {
            overallScore: 30,
            grade: 'D',
            environmentalScore: 10,
            socialScore: 40,
            governanceScore: 40,
            energyIntensity: 2500000,
          },
        },
      ],
    };

    render(<EsgHoldingsBreakdown analysis={largeNumberAnalysis} />);

    expect(screen.getByText('2.50M kWh/tx')).toBeInTheDocument();
  });

  it('should render icons for environmental metrics', () => {
    render(<EsgHoldingsBreakdown analysis={mockAnalysis} />);

    expect(screen.getAllByTestId('zap-icon').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('cloud-icon').length).toBeGreaterThan(0);
  });
});
