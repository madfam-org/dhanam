import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { ReadyToAssign } from './ready-to-assign';

// Mock UI components
jest.mock('@dhanam/ui', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>,
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, type, placeholder, className, max }: any) => (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      className={className}
      max={max}
      data-testid="input"
    />
  ),
  Label: ({ children, className }: any) => <label className={className}>{children}</label>,
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  AlertDescription: ({ children }: any) => <span data-testid="alert-description">{children}</span>,
}));

jest.mock('lucide-react', () => ({
  DollarSign: () => <svg data-testid="dollar-icon" />,
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
  CheckCircle2: () => <svg data-testid="check-circle-icon" />,
}));

const mockCategories = [
  { id: 'cat-1', name: 'Groceries', budgetedAmount: 500, carryoverAmount: 50 },
  { id: 'cat-2', name: 'Entertainment', budgetedAmount: 200, carryoverAmount: 0 },
  { id: 'cat-3', name: 'Utilities', budgetedAmount: 150, carryoverAmount: 25 },
];

const defaultProps = {
  budgetId: 'budget-123',
  income: 5000,
  totalBudgeted: 4500,
  totalCarryover: 75,
  readyToAssign: 575,
  categories: mockCategories,
  onUpdateIncome: jest.fn(),
  onAllocateFunds: jest.fn(),
};

describe('ReadyToAssign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the card with title', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Ready to Assign')).toBeInTheDocument();
      expect(
        screen.getByText('Zero-Based Budgeting - Assign every dollar a job')
      ).toBeInTheDocument();
    });

    it('should display the ready to assign amount', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('$575.00')).toBeInTheDocument();
    });

    it('should apply orange color when funds are unassigned', () => {
      render(<ReadyToAssign {...defaultProps} />);

      const amountText = screen.getByText('$575.00');
      expect(amountText.className).toContain('text-orange-600');
    });

    it('should apply green color when all funds are assigned', () => {
      render(<ReadyToAssign {...defaultProps} readyToAssign={0} />);

      const amountText = screen.getByText('$0.00');
      expect(amountText.className).toContain('text-green-600');
    });

    it('should show warning alert when funds are unassigned', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText(/You have \$575\.00 unassigned!/)).toBeInTheDocument();
      expect(screen.getByText(/Give every dollar a job/)).toBeInTheDocument();
    });

    it('should show success alert when all funds are assigned', () => {
      render(<ReadyToAssign {...defaultProps} readyToAssign={0} />);

      expect(screen.getByText(/All funds assigned!/)).toBeInTheDocument();
    });
  });

  describe('Budget Summary', () => {
    it('should display income amount', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Income')).toBeInTheDocument();
      expect(screen.getAllByText('$5,000.00').length).toBeGreaterThanOrEqual(1);
    });

    it('should display carryover amount', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Carryover')).toBeInTheDocument();
      expect(screen.getByText('$75.00')).toBeInTheDocument();
    });

    it('should display budgeted amount', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Budgeted')).toBeInTheDocument();
      expect(screen.getByText('$4,500.00')).toBeInTheDocument();
    });
  });

  describe('Income Editing', () => {
    it('should show Update Income button by default', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Update Income')).toBeInTheDocument();
    });

    it('should switch to edit mode when Update Income is clicked', () => {
      render(<ReadyToAssign {...defaultProps} />);

      fireEvent.click(screen.getByText('Update Income'));

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onUpdateIncome when saving', async () => {
      const mockOnUpdateIncome = jest.fn().mockResolvedValue(undefined);
      render(<ReadyToAssign {...defaultProps} onUpdateIncome={mockOnUpdateIncome} />);

      fireEvent.click(screen.getByText('Update Income'));

      const inputs = screen.getAllByTestId('input');
      const incomeInput = inputs[0];
      fireEvent.change(incomeInput, { target: { value: '6000' } });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnUpdateIncome).toHaveBeenCalledWith(6000);
      });
    });

    it('should cancel editing when Cancel is clicked', () => {
      render(<ReadyToAssign {...defaultProps} />);

      fireEvent.click(screen.getByText('Update Income'));
      expect(screen.getByText('Save')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.getByText('Update Income')).toBeInTheDocument();
    });
  });

  describe('Quick Allocate', () => {
    it('should show quick allocate section when funds are unassigned', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Quick Allocate Funds')).toBeInTheDocument();
    });

    it('should not show quick allocate section when all funds assigned', () => {
      render(<ReadyToAssign {...defaultProps} readyToAssign={0} />);

      expect(screen.queryByText('Quick Allocate Funds')).not.toBeInTheDocument();
    });

    it('should display category options in dropdown', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText(/Groceries/)).toBeInTheDocument();
      expect(screen.getByText(/Entertainment/)).toBeInTheDocument();
      expect(screen.getByText(/Utilities/)).toBeInTheDocument();
    });

    it('should show combined budgeted and carryover amount for categories', () => {
      render(<ReadyToAssign {...defaultProps} />);

      // Groceries: $500 + $50 = $550
      expect(screen.getByText(/Groceries \(\$550\.00\)/)).toBeInTheDocument();
    });

    it('should have Allocate button', () => {
      render(<ReadyToAssign {...defaultProps} />);

      expect(screen.getByText('Allocate')).toBeInTheDocument();
    });

    it('should disable Allocate button when no category selected', () => {
      render(<ReadyToAssign {...defaultProps} />);

      const allocateButton = screen.getByText('Allocate');
      expect(allocateButton).toBeDisabled();
    });

    it('should call onAllocateFunds when allocating', async () => {
      const mockOnAllocateFunds = jest.fn().mockResolvedValue(undefined);
      render(<ReadyToAssign {...defaultProps} onAllocateFunds={mockOnAllocateFunds} />);

      // Select category
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'cat-1' } });

      // Enter amount
      const inputs = screen.getAllByTestId('input');
      const amountInput = inputs.find((input) => input.getAttribute('placeholder') === 'Amount');
      if (amountInput) {
        fireEvent.change(amountInput, { target: { value: '100' } });
      }

      // Click Allocate
      fireEvent.click(screen.getByText('Allocate'));

      await waitFor(() => {
        expect(mockOnAllocateFunds).toHaveBeenCalledWith('cat-1', 100);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero income', () => {
      render(<ReadyToAssign {...defaultProps} income={0} />);

      expect(screen.getAllByText('$0.00').length).toBeGreaterThanOrEqual(1);
    });

    it('should handle negative ready to assign (overspent)', () => {
      render(<ReadyToAssign {...defaultProps} readyToAssign={-100} />);

      // Should still show the amount
      expect(screen.getByText('-$100.00')).toBeInTheDocument();
    });

    it('should handle empty categories', () => {
      render(<ReadyToAssign {...defaultProps} categories={[]} />);

      expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
    });

    it('should handle error in onUpdateIncome', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockOnUpdateIncome = jest.fn().mockRejectedValue(new Error('API Error'));

      render(<ReadyToAssign {...defaultProps} onUpdateIncome={mockOnUpdateIncome} />);

      fireEvent.click(screen.getByText('Update Income'));
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockOnUpdateIncome).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle error in onAllocateFunds', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const mockOnAllocateFunds = jest.fn().mockRejectedValue(new Error('API Error'));

      render(<ReadyToAssign {...defaultProps} onAllocateFunds={mockOnAllocateFunds} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'cat-1' } });

      const inputs = screen.getAllByTestId('input');
      const amountInput = inputs.find((input) => input.getAttribute('placeholder') === 'Amount');
      if (amountInput) {
        fireEvent.change(amountInput, { target: { value: '100' } });
      }

      fireEvent.click(screen.getByText('Allocate'));

      await waitFor(() => {
        expect(mockOnAllocateFunds).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
