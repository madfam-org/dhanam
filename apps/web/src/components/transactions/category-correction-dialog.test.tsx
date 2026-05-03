import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CategoryCorrectionDialog } from './category-correction-dialog';

// Mock tanstack query
const mockMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
  useQuery: jest.fn(({ queryKey }: any) => {
    if (queryKey[0] === 'categories') {
      return {
        data: mockCategories,
        isLoading: false,
      };
    }
    if (queryKey[0] === 'ml-prediction') {
      return {
        data: mockPrediction,
      };
    }
    return { data: undefined, isLoading: false };
  }),
  useMutation: jest.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

// Mock space store
jest.mock('@/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal' },
  }),
}));

// Mock API modules
jest.mock('@/lib/api/categories', () => ({
  categoriesApi: {
    getCategories: jest.fn(),
  },
}));

jest.mock('@/lib/api/ml', () => ({
  mlApi: {
    predictCategory: jest.fn(),
    correctCategory: jest.fn(),
  },
}));

// Mock cn util
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock analytics
jest.mock('@/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    trackTxnCategorized: jest.fn(),
    track: jest.fn(),
  }),
}));

// Mock UI components
jest.mock('@dhanam/ui', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? (
      <div data-testid="dialog" data-open={open}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
  Checkbox: ({ id, checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      data-testid={`checkbox-${id || 'generic'}`}
    />
  ),
  Label: ({ children, htmlFor, className }: any) => (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ),
}));

jest.mock('lucide-react', () => ({
  Loader2: ({ className }: any) => <span data-testid="loader-icon" className={className} />,
  Sparkles: ({ className }: any) => <span data-testid="sparkles-icon" className={className} />,
  Check: ({ className }: any) => <span data-testid="check-icon" className={className} />,
}));

const mockCategories = [
  { id: 'cat-1', name: 'Groceries', icon: '🛒' },
  { id: 'cat-2', name: 'Transport', icon: '🚗' },
  { id: 'cat-3', name: 'Entertainment', icon: '🎬' },
];

const mockPrediction = {
  categoryId: 'cat-1',
  categoryName: 'Groceries',
  confidence: 0.92,
  source: 'merchant',
  reasoning: 'Based on merchant history',
};

const defaultTransaction = {
  id: 'tx-1',
  description: 'Walmart Purchase',
  merchant: 'Walmart',
  amount: -45.99,
  categoryId: null,
};

const defaultProps = {
  open: true,
  onOpenChange: jest.fn(),
  transaction: defaultTransaction,
  onCorrectionComplete: jest.fn(),
};

const defaultUseQuery = ({ queryKey }: any) => {
  if (queryKey[0] === 'categories') return { data: mockCategories, isLoading: false };
  if (queryKey[0] === 'ml-prediction') return { data: mockPrediction };
  return { data: undefined, isLoading: false };
};

const defaultUseMutation = () => ({ mutate: mockMutate, isPending: false });

describe('CategoryCorrectionDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations after tests that override them
    const rq = require('@tanstack/react-query');
    rq.useQuery.mockImplementation(defaultUseQuery);
    rq.useMutation.mockImplementation(defaultUseMutation);
  });

  describe('Rendering', () => {
    it('should render dialog when open', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Categorize Transaction');
    });

    it('should not render dialog when closed', () => {
      render(<CategoryCorrectionDialog {...defaultProps} open={false} />);

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should show merchant name in description', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Walmart')).toBeInTheDocument();
    });

    it('should show transaction amount', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('$45.99')).toBeInTheDocument();
    });

    it('should fall back to description when merchant is null', () => {
      const tx = { ...defaultTransaction, merchant: null };
      render(<CategoryCorrectionDialog {...defaultProps} transaction={tx} />);

      expect(screen.getByText('Walmart Purchase')).toBeInTheDocument();
    });
  });

  describe('ML Suggestion', () => {
    it('should show AI suggestion when prediction exists and no current category', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('AI Suggestion')).toBeInTheDocument();
      // 'Groceries' appears both in ML suggestion and category list
      expect(screen.getAllByText('Groceries').length).toBeGreaterThanOrEqual(1);
    });

    it('should show confidence badge', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('High confidence')).toBeInTheDocument();
    });

    it('should show prediction source and reasoning', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText(/Historical pattern/)).toBeInTheDocument();
      expect(screen.getByText(/Based on merchant history/)).toBeInTheDocument();
    });

    it('should show Accept suggestion button', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Accept suggestion')).toBeInTheDocument();
    });

    it('should not show AI suggestion when transaction already has a category', () => {
      const tx = { ...defaultTransaction, categoryId: 'cat-2' };
      // When categoryId is set, the prediction query is disabled, so mock returns no data
      const { useQuery } = require('@tanstack/react-query');
      useQuery.mockImplementation(({ queryKey }: any) => {
        if (queryKey[0] === 'categories') return { data: mockCategories, isLoading: false };
        if (queryKey[0] === 'ml-prediction') return { data: undefined };
        return { data: undefined, isLoading: false };
      });

      render(<CategoryCorrectionDialog {...defaultProps} transaction={tx} />);

      expect(screen.queryByText('AI Suggestion')).not.toBeInTheDocument();
    });
  });

  describe('Category List', () => {
    it('should show category selection label', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Select category')).toBeInTheDocument();
    });

    it('should render all categories', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      // 'Groceries' appears in both ML suggestion and category list
      expect(screen.getAllByText('Groceries').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('should show category icons', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('🛒')).toBeInTheDocument();
      expect(screen.getByText('🚗')).toBeInTheDocument();
      expect(screen.getByText('🎬')).toBeInTheDocument();
    });

    it('should show loading state when categories are loading', () => {
      const { useQuery } = require('@tanstack/react-query');
      useQuery.mockImplementation(({ queryKey }: any) => {
        if (queryKey[0] === 'categories') return { data: undefined, isLoading: true };
        if (queryKey[0] === 'ml-prediction') return { data: mockPrediction };
        return { data: undefined, isLoading: false };
      });

      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });

    it('should allow selecting a category', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Transport'));

      // After clicking, the button should have the selected styling applied via cn
      const transportButton = screen.getByText('Transport').closest('button');
      expect(transportButton).toBeInTheDocument();
    });
  });

  describe('Correction Submission', () => {
    it('should have Save Category button', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Save Category')).toBeInTheDocument();
    });

    it('should disable Save button when no category is selected', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      const saveButton = screen.getByText('Save Category');
      expect(saveButton).toBeDisabled();
    });

    it('should enable Save button after selecting a category', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Transport'));

      const saveButton = screen.getByText('Save Category');
      expect(saveButton).not.toBeDisabled();
    });

    it('should call mutate when Save Category is clicked', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Transport'));
      fireEvent.click(screen.getByText('Save Category'));

      expect(mockMutate).toHaveBeenCalledWith('cat-2');
    });

    it('should show loading state during correction', () => {
      const { useMutation } = require('@tanstack/react-query');
      useMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      });

      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    });
  });

  describe('Apply to Future Checkbox', () => {
    it('should show apply to future transactions checkbox', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Apply to future transactions')).toBeInTheDocument();
    });

    it('should be checked by default', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      const checkbox = screen.getByTestId('checkbox-applyToFuture');
      expect(checkbox).toBeChecked();
    });

    it('should show merchant name in helper text', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText(/Similar transactions from Walmart/)).toBeInTheDocument();
    });

    it('should show fallback text when no merchant', () => {
      const tx = { ...defaultTransaction, merchant: null };
      render(<CategoryCorrectionDialog {...defaultProps} transaction={tx} />);

      expect(screen.getByText(/Similar transactions from this merchant/)).toBeInTheDocument();
    });

    it('should toggle the checkbox', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      const checkbox = screen.getByTestId('checkbox-applyToFuture');
      fireEvent.click(checkbox);

      expect(checkbox).not.toBeChecked();
    });
  });

  describe('Dismiss Behavior', () => {
    it('should have Cancel button', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onOpenChange with false when Cancel is clicked', () => {
      render(<CategoryCorrectionDialog {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
