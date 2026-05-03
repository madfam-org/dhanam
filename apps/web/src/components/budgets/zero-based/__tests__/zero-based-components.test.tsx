import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock @dhanam/ui with Proxy
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
      if (params?.percent !== undefined) return `${params.percent}% funded`;
      if (params?.count !== undefined) return `${params.count} ${key.split('.').pop()}`;
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

jest.mock('@/lib/utils', () => ({
  formatCurrency: (amount: number) => `$${amount?.toFixed?.(2) ?? '0.00'}`,
  formatDate: (date: any) => String(date),
  getCurrencySymbol: (currency: string) => (currency === 'EUR' ? '€' : '$'),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/api/zero-based', () => ({}));

import { CategoryRow } from '../category-row';
import { MonthSelector } from '../month-selector';
import { ReadyToAssignBanner } from '../ready-to-assign-banner';

describe('ReadyToAssignBanner', () => {
  const defaultProps = {
    totalIncome: 5000,
    totalAllocated: 4000,
    unallocated: 1000,
    totalSpent: 2500,
    isFullyAllocated: false,
    currency: 'USD' as any,
    onAllocate: jest.fn(),
    onAutoAllocate: jest.fn(),
    isAutoAllocating: false,
  };

  it('renders with role="status" and aria-live for accessibility', () => {
    render(<ReadyToAssignBanner {...defaultProps} />);

    const statusSection = document.querySelector('[role="status"]');
    expect(statusSection).not.toBeNull();
    expect(statusSection).toHaveAttribute('aria-live', 'polite');
  });

  it('renders translated summary labels', () => {
    render(<ReadyToAssignBanner {...defaultProps} />);

    expect(screen.getByText('zeroBased.banner.income')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.banner.allocated')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.banner.spent')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.banner.unallocated')).toBeInTheDocument();
  });

  it('shows action buttons when under-allocated', () => {
    render(<ReadyToAssignBanner {...defaultProps} />);

    expect(screen.getByText('zeroBased.banner.autoAllocate')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.banner.allocate')).toBeInTheDocument();
  });

  it('hides action buttons when fully allocated', () => {
    render(<ReadyToAssignBanner {...defaultProps} unallocated={0} isFullyAllocated={true} />);

    expect(screen.queryByText('zeroBased.banner.autoAllocate')).not.toBeInTheDocument();
  });
});

describe('CategoryRow', () => {
  const defaultProps = {
    category: {
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      budgetedAmount: 500,
      carryoverAmount: 0,
      allocated: 300,
      spent: 200,
      available: 100,
      isOverspent: false,
    },
    currency: 'USD' as any,
    onAllocate: jest.fn(),
    onMoveFunds: jest.fn(),
    onEditGoal: jest.fn(),
  };

  it('renders action buttons with aria-labels', () => {
    render(<CategoryRow {...defaultProps} />);

    expect(screen.getByLabelText('zeroBased.categoryRow.allocateFunds')).toBeInTheDocument();
    expect(screen.getByLabelText('zeroBased.categoryRow.moveFunds')).toBeInTheDocument();
    expect(screen.getByLabelText('zeroBased.categoryRow.editGoal')).toBeInTheDocument();
  });

  it('renders translated column headers', () => {
    render(<CategoryRow {...defaultProps} />);

    expect(screen.getByText('zeroBased.categoryRow.allocated')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.categoryRow.spent')).toBeInTheDocument();
    expect(screen.getByText('zeroBased.categoryRow.available')).toBeInTheDocument();
  });

  it('applies group-focus-within class for keyboard accessibility', () => {
    const { container } = render(<CategoryRow {...defaultProps} />);

    const row = container.querySelector('.group');
    expect(row).not.toBeNull();

    const actionDiv = container.querySelector('.group-focus-within\\:opacity-100');
    expect(actionDiv).not.toBeNull();
  });
});

describe('MonthSelector', () => {
  it('renders nav elements with aria-label for accessibility', () => {
    const { container } = render(
      <MonthSelector currentMonth="2026-04" onMonthChange={jest.fn()} />
    );

    const ariaLabeledElements = container.querySelectorAll('[aria-label]');
    expect(ariaLabeledElements.length).toBeGreaterThanOrEqual(2);
  });
});
