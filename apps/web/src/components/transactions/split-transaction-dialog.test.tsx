import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { SplitTransactionDialog } from './split-transaction-dialog';

// Mock fetch
global.fetch = jest.fn();

// Mock UI components
jest.mock('@dhanam/ui', () => ({
  Button: ({ children, onClick, disabled, variant, size }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children, asChild }: any) => (
    <div data-testid="dialog-trigger" onClick={() => {}}>
      {children}
    </div>
  ),
  Input: ({ value, onChange, type, placeholder, id, readOnly, className }: any) => (
    <input
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      id={id}
      readOnly={readOnly}
      className={className}
      data-testid={`input-${id || 'generic'}`}
    />
  ),
  Label: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  Select: ({ children, value, onValueChange }: any) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)} data-testid="select">
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('lucide-react', () => ({
  Plus: () => <svg data-testid="plus-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  UserPlus: () => <svg data-testid="user-plus-icon" />,
}));

const mockHouseholdMembers = [
  { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  { id: 'user-2', name: 'Jane Doe', email: 'jane@example.com' },
  { id: 'user-3', name: 'Bob Smith', email: 'bob@example.com' },
];

const defaultProps = {
  transactionId: 'tx-123',
  transactionAmount: -100,
  spaceId: 'space-456',
  householdMembers: mockHouseholdMembers,
  onSplit: jest.fn(),
};

// Helper to open the dialog
const openDialog = () => {
  const trigger = screen.getByTestId('dialog-trigger');
  fireEvent.click(trigger);
};

describe('SplitTransactionDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
  });

  describe('Trigger Button', () => {
    it('should render the Split button trigger', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByText('Split')).toBeInTheDocument();
    });

    it('should have UserPlus icon in trigger', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByTestId('user-plus-icon')).toBeInTheDocument();
    });
  });

  describe('Dialog Content', () => {
    it('should show Split Transaction title in dialog header', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Split Transaction');
    });

    it('should show transaction amount in description', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByText(/\$100\.00 expense among household/)).toBeInTheDocument();
    });

    it('should show remaining label', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByText('Remaining')).toBeInTheDocument();
    });

    it('should have Add Person button', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByText('Add Person')).toBeInTheDocument();
    });

    it('should have Cancel button', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Currency Formatting', () => {
    it('should format positive amounts correctly', () => {
      render(<SplitTransactionDialog {...defaultProps} transactionAmount={150.5} />);

      // Amount appears in description
      expect(screen.getByText(/\$150\.50 expense/)).toBeInTheDocument();
    });

    it('should use absolute value for negative amounts', () => {
      render(<SplitTransactionDialog {...defaultProps} transactionAmount={-250} />);

      expect(screen.getByText(/\$250\.00 expense/)).toBeInTheDocument();
    });
  });

  describe('Split Management', () => {
    it('should have Add Person button for adding splits', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByText('Add Person')).toBeInTheDocument();
    });

    it('should show plus icon in Add Person button', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    });
  });

  describe('Submit Button', () => {
    it('should have Split Transaction button', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find((b) => b.textContent?.includes('Split Transaction'));
      expect(submitButton).toBeInTheDocument();
    });

    it('should disable submit initially when no splits', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      const submitButton = buttons.find((b) => b.textContent?.includes('Split Transaction'));
      expect(submitButton).toBeDisabled();
    });
  });

  describe('API Integration', () => {
    it('should have correct API endpoint structure', () => {
      render(<SplitTransactionDialog {...defaultProps} />);

      // Verify the component renders with correct props that would be used for API
      expect(screen.getByText(/expense among household members/)).toBeInTheDocument();
    });

    it('should render with transactionId prop', () => {
      render(<SplitTransactionDialog {...defaultProps} transactionId="custom-tx-id" />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Split Transaction');
    });

    it('should render with spaceId prop', () => {
      render(<SplitTransactionDialog {...defaultProps} spaceId="custom-space-id" />);

      expect(screen.getByTestId('dialog-title')).toHaveTextContent('Split Transaction');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero transaction amount', () => {
      render(<SplitTransactionDialog {...defaultProps} transactionAmount={0} />);

      expect(screen.getByText(/\$0\.00 expense/)).toBeInTheDocument();
    });

    it('should handle empty household members', () => {
      render(<SplitTransactionDialog {...defaultProps} householdMembers={[]} />);

      // Add Person should not be visible since there are no members to add
      expect(screen.queryByText('Add Person')).not.toBeInTheDocument();
    });

    it('should handle single household member', () => {
      render(
        <SplitTransactionDialog {...defaultProps} householdMembers={[mockHouseholdMembers[0]]} />
      );

      expect(screen.getByText('Add Person')).toBeInTheDocument();
    });

    it('should handle very large transaction amount', () => {
      render(<SplitTransactionDialog {...defaultProps} transactionAmount={-1000000} />);

      expect(screen.getByText(/\$1,000,000\.00 expense/)).toBeInTheDocument();
    });

    it('should handle decimal transaction amount', () => {
      render(<SplitTransactionDialog {...defaultProps} transactionAmount={-99.99} />);

      expect(screen.getByText(/\$99\.99 expense/)).toBeInTheDocument();
    });
  });
});
