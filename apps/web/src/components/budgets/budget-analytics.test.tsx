import { Currency } from '@dhanam/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { BudgetAnalytics } from './budget-analytics';

// Create a test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

// Mock the API hooks
jest.mock('@/lib/api/budgets', () => ({
  budgetsApi: {
    getBudgetAnalytics: jest.fn(),
  },
}));

// Mock Recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockBudgetAnalytics = {
  summary: {
    totalBudget: 3000,
    totalSpent: 2100,
    remainingBudget: 900,
    totalPercentUsed: 70,
  },
  categories: [
    {
      id: 'cat1',
      name: 'Groceries',
      type: 'expense',
      budgeted: 500,
      spent: 350,
      remaining: 150,
      percentage: 70,
    },
    {
      id: 'cat2',
      name: 'Dining',
      type: 'expense',
      budgeted: 300,
      spent: 280,
      remaining: 20,
      percentage: 93.3,
    },
    {
      id: 'cat3',
      name: 'Transportation',
      type: 'expense',
      budgeted: 400,
      spent: 200,
      remaining: 200,
      percentage: 50,
    },
  ],
  insights: [
    'You are 93% through your Dining budget',
    'Transportation spending is well under control',
    'Consider reducing dining expenses this month',
  ],
  weeklyTrend: [
    { weekStart: '2024-11-01', spent: 1800, budgetedForWeek: 750 },
    { weekStart: '2024-12-01', spent: 2000, budgetedForWeek: 750 },
    { weekStart: '2025-01-01', spent: 2100, budgetedForWeek: 750 },
  ],
};

describe.skip('BudgetAnalytics', () => {
  beforeEach(() => {
    const { budgetsApi } = require('@/lib/api/budgets');
    budgetsApi.getBudgetAnalytics.mockResolvedValue(mockBudgetAnalytics);
  });

  it('should render budget analytics with all sections', async () => {
    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    // Check main sections
    expect(screen.getByText('Budget Overview')).toBeInTheDocument();
    expect(screen.getByText('Category Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Spending Trends')).toBeInTheDocument();
    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('should display budget summary correctly', async () => {
    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    // Wait for async data and check budget summary
    await screen.findByText('$3,000.00');
    await screen.findByText('$2,100.00');
    await screen.findByText('$900.00');
  });

  it('should show category spending details', async () => {
    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    // Check category details
    await screen.findByText('Groceries');
    await screen.findByText('Dining');
    await screen.findByText('Transportation');

    await screen.findByText('70%');
    await screen.findByText('93%');
    await screen.findByText('50%');
  });

  it('should display insights', async () => {
    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    // Check insights
    await screen.findByText('You are 93% through your Dining budget');
    await screen.findByText('Transportation spending is well under control');
    await screen.findByText('Consider reducing dining expenses this month');
  });

  it('should render charts', async () => {
    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    // Check if chart components are rendered
    expect(screen.getAllByTestId('responsive-container')).toHaveLength(2);
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    const { budgetsApi } = require('@/lib/api/budgets');
    budgetsApi.getBudgetAnalytics.mockImplementation(() => new Promise(() => {}));

    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    const { budgetsApi } = require('@/lib/api/budgets');
    budgetsApi.getBudgetAnalytics.mockRejectedValue(new Error('Analytics API Error'));

    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    await screen.findByText('Failed to load budget analytics');
  });

  it('should highlight over-budget categories', async () => {
    const overBudgetAnalytics = {
      ...mockBudgetAnalytics,
      summary: {
        ...mockBudgetAnalytics.summary,
        totalPercentUsed: 117,
      },
      categories: [
        {
          id: 'cat1',
          name: 'Dining',
          type: 'expense',
          budgeted: 300,
          spent: 350,
          remaining: -50,
          percentage: 116.7,
        },
      ],
    };

    const { budgetsApi } = require('@/lib/api/budgets');
    budgetsApi.getBudgetAnalytics.mockResolvedValue(overBudgetAnalytics);

    render(
      <BudgetAnalytics spaceId="test-space" budgetId="test-budget" currency={Currency.USD} />,
      { wrapper: TestWrapper }
    );

    // Should show over-budget indicator
    await screen.findByText('117%'); // Rounded percentage
    expect(screen.getByText('Over Budget')).toBeInTheDocument();
  });
});
