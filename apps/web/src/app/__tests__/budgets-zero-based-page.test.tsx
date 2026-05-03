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
    t: (key: string, params?: any) => {
      if (params?.name) return `${key} ${params.name}`;
      return key;
    },
    locale: 'en',
    setLocale: jest.fn(),
  }),
  Currency: { USD: 'USD', MXN: 'MXN', EUR: 'EUR' },
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

const mockAllocationStatus = jest.fn();

jest.mock('@/hooks/useZeroBasedQuery', () => ({
  useAllocationStatus: (...args: any[]) => mockAllocationStatus(...args),
  useCreateIncomeEvent: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAllocateFunds: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useMoveFunds: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAutoAllocate: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRolloverMonth: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSetCategoryGoal: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
  }),
}));

jest.mock('@/components/budgets/zero-based', () => ({
  ReadyToAssignBanner: (props: any) => <div data-testid="ready-to-assign-banner" />,
  CategoryAllocationList: (props: any) => <div data-testid="category-allocation-list" />,
  MonthSelector: (props: any) => <div data-testid="month-selector" />,
  AllocateModal: (props: any) => <div data-testid="allocate-modal" />,
  MoveFundsModal: (props: any) => <div data-testid="move-funds-modal" />,
  AddIncomeModal: (props: any) => <div data-testid="add-income-modal" />,
  IncomeEventsList: (props: any) => <div data-testid="income-events-list" />,
  GoalEditor: (props: any) => <div data-testid="goal-editor" />,
  RolloverModal: (props: any) => <div data-testid="rollover-modal" />,
}));

jest.mock('@/lib/api/zero-based', () => ({
  CategoryAllocationStatus: {},
  CreateIncomeEventDto: {},
  SetCategoryGoalDto: {},
}));

import ZeroBasedBudgetPage from '../(dashboard)/budgets/zero-based/page';

describe('ZeroBasedBudgetPage', () => {
  beforeEach(() => {
    mockAllocationStatus.mockReturnValue({
      data: {
        totalIncome: 5000,
        totalAllocated: 4000,
        unallocated: 1000,
        totalSpent: 2500,
        isFullyAllocated: false,
        categories: [],
        incomeEvents: [],
      },
      isLoading: false,
      error: null,
    });
  });

  it('should render the page title', () => {
    render(<ZeroBasedBudgetPage />);
    expect(screen.getByText('zeroBased.title')).toBeInTheDocument();
  });

  it('should render the page description with space name', () => {
    render(<ZeroBasedBudgetPage />);
    expect(screen.getByText('zeroBased.description Personal')).toBeInTheDocument();
  });

  it('should render action buttons for add income and rollover', () => {
    render(<ZeroBasedBudgetPage />);
    expect(screen.getByText('zeroBased.addIncome')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.rollover')).toBeInTheDocument();
  });

  it('should render zero-based budget components when data is loaded', () => {
    render(<ZeroBasedBudgetPage />);
    expect(screen.getByTestId('ready-to-assign-banner')).toBeInTheDocument();
    expect(screen.getByTestId('category-allocation-list')).toBeInTheDocument();
    expect(screen.getByTestId('month-selector')).toBeInTheDocument();
    expect(screen.getByTestId('income-events-list')).toBeInTheDocument();
  });

  it('should render loading state when data is loading', () => {
    mockAllocationStatus.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    render(<ZeroBasedBudgetPage />);
    expect(screen.getByText('zeroBased.loading')).toBeInTheDocument();
  });

  it('should render error state when query fails', () => {
    mockAllocationStatus.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
    });

    render(<ZeroBasedBudgetPage />);
    expect(screen.getByText('zeroBased.errorTitle')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.retry')).toBeInTheDocument();
  });
});
