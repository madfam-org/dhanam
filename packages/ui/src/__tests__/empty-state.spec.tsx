import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../components/empty-state';

// Mock the dependencies
jest.mock('../components/button', () => ({
  Button: ({ children, onClick, asChild }: any) => {
    if (asChild) {
      return <div data-testid="button-as-child">{children}</div>;
    }
    return (
      <button data-testid="button" onClick={onClick}>
        {children}
      </button>
    );
  },
}));

jest.mock('../components/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

// Mock icon components - cast to any to satisfy ForwardRefExoticComponent type
// This is acceptable in tests since we're mocking Lucide icon components
const MockIcon = ((props: any) => <svg data-testid="mock-icon" {...props} />) as any;

const MockActionIcon = ((props: any) => <svg data-testid="mock-action-icon" {...props} />) as any;

describe('EmptyState', () => {
  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      render(<EmptyState icon={MockIcon} title="No items found" />);

      expect(screen.getByText('No items found')).toBeInTheDocument();
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument();
    });

    it('should render the icon', () => {
      render(<EmptyState icon={MockIcon} title="Test Title" />);

      const icon = screen.getByTestId('mock-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('h-8');
      expect(icon).toHaveClass('w-8');
    });

    it('should render the title', () => {
      render(<EmptyState icon={MockIcon} title="Empty State Title" />);

      const title = screen.getByText('Empty State Title');
      expect(title).toBeInTheDocument();
      expect(title.tagName.toLowerCase()).toBe('h3');
    });

    it('should apply border-dashed class to card', () => {
      render(<EmptyState icon={MockIcon} title="Test" />);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('border-dashed');
    });
  });

  describe('Description', () => {
    it('should render description when provided', () => {
      render(<EmptyState icon={MockIcon} title="Test Title" description="This is a description" />);

      expect(screen.getByText('This is a description')).toBeInTheDocument();
    });

    it('should not render description when not provided', () => {
      render(<EmptyState icon={MockIcon} title="Test Title" />);

      const description = screen.queryByText('This is a description');
      expect(description).not.toBeInTheDocument();
    });

    it('description should have correct styling classes', () => {
      render(<EmptyState icon={MockIcon} title="Test" description="Test description" />);

      const description = screen.getByText('Test description');
      expect(description).toHaveClass('text-muted-foreground');
      expect(description).toHaveClass('text-sm');
    });
  });

  describe('Action with onClick', () => {
    it('should render button with onClick action', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Click me',
            onClick: handleClick,
          }}
        />
      );

      const button = screen.getByTestId('button');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should call onClick when button is clicked', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Click me',
            onClick: handleClick,
          }}
        />
      );

      fireEvent.click(screen.getByTestId('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should render action icon when provided', () => {
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Click me',
            onClick: jest.fn(),
            icon: MockActionIcon,
          }}
        />
      );

      expect(screen.getByTestId('mock-action-icon')).toBeInTheDocument();
    });
  });

  describe('Action with href', () => {
    it('should render link when href is provided', () => {
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Go somewhere',
            href: '/some-path',
          }}
        />
      );

      expect(screen.getByTestId('button-as-child')).toBeInTheDocument();
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/some-path');
    });

    it('should render action icon in link', () => {
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Go somewhere',
            href: '/path',
            icon: MockActionIcon,
          }}
        />
      );

      expect(screen.getByTestId('mock-action-icon')).toBeInTheDocument();
    });

    it('href should take precedence over onClick', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Action',
            href: '/path',
            onClick: handleClick,
          }}
        />
      );

      // Should render as link (asChild button), not regular button
      expect(screen.getByTestId('button-as-child')).toBeInTheDocument();
      expect(screen.queryByTestId('button')).not.toBeInTheDocument();
    });
  });

  describe('No Action', () => {
    it('should not render action button when not provided', () => {
      render(<EmptyState icon={MockIcon} title="Test Title" />);

      expect(screen.queryByTestId('button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('button-as-child')).not.toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to card', () => {
      render(<EmptyState icon={MockIcon} title="Test" className="custom-class" />);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-class');
      expect(card).toHaveClass('border-dashed');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<EmptyState icon={MockIcon} title="Accessible Title" />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('Accessible Title');
    });

    it('action button should be interactive', () => {
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Action Button',
            onClick: jest.fn(),
          }}
        />
      );

      const button = screen.getByTestId('button');
      expect(button).not.toBeDisabled();
    });

    it('link should be accessible', () => {
      render(
        <EmptyState
          icon={MockIcon}
          title="Test"
          action={{
            label: 'Link Action',
            href: '/accessible-path',
          }}
        />
      );

      const link = screen.getByRole('link');
      expect(link).toHaveTextContent('Link Action');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string title', () => {
      render(<EmptyState icon={MockIcon} title="" />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('');
    });

    it('should handle long title', () => {
      const longTitle = 'A'.repeat(200);
      render(<EmptyState icon={MockIcon} title={longTitle} />);

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle long description', () => {
      const longDesc = 'B'.repeat(500);
      render(<EmptyState icon={MockIcon} title="Test" description={longDesc} />);

      expect(screen.getByText(longDesc)).toBeInTheDocument();
    });
  });
});
