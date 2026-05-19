import React from 'react';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../components/alert';

describe('Alert', () => {
  describe('Basic Rendering', () => {
    it('should render children', () => {
      render(<Alert>Alert content</Alert>);
      expect(screen.getByText('Alert content')).toBeInTheDocument();
    });

    it('should have role="alert" for accessibility', () => {
      render(<Alert>Alert</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should apply base classes', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('relative');
      expect(alert).toHaveClass('w-full');
      expect(alert).toHaveClass('rounded-lg');
      expect(alert).toHaveClass('border');
      expect(alert).toHaveClass('p-4');
    });

    it('should support ref forwarding', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Alert ref={ref}>Alert</Alert>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Variants', () => {
    it('should apply default variant classes', () => {
      render(<Alert variant="default">Default Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-background');
      expect(alert).toHaveClass('text-foreground');
    });

    it('should apply destructive variant classes', () => {
      render(<Alert variant="destructive">Error Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('text-destructive');
    });

    it('should apply warning variant classes', () => {
      render(<Alert variant="warning">Warning Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('text-warning-foreground');
    });

    it('should use default variant when no variant specified', () => {
      render(<Alert>Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-background');
    });
  });

  describe('Custom className', () => {
    it('should merge custom className', () => {
      render(<Alert className="my-custom-class">Alert</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('my-custom-class');
      expect(alert).toHaveClass('relative');
    });
  });
});

describe('AlertTitle', () => {
  describe('Basic Rendering', () => {
    it('should render as h5 element', () => {
      render(<AlertTitle>Title</AlertTitle>);
      const title = screen.getByText('Title');
      expect(title.tagName.toLowerCase()).toBe('h5');
    });

    it('should render children', () => {
      render(<AlertTitle>Alert Title</AlertTitle>);
      expect(screen.getByText('Alert Title')).toBeInTheDocument();
    });

    it('should apply base classes', () => {
      render(<AlertTitle>Title</AlertTitle>);
      const title = screen.getByText('Title');
      expect(title).toHaveClass('mb-1');
      expect(title).toHaveClass('font-medium');
      expect(title).toHaveClass('leading-none');
      expect(title).toHaveClass('tracking-tight');
    });

    it('should support ref forwarding', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertTitle ref={ref}>Title</AlertTitle>);
      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
    });
  });

  describe('Custom className', () => {
    it('should merge custom className', () => {
      render(<AlertTitle className="text-red-500">Title</AlertTitle>);
      const title = screen.getByText('Title');
      expect(title).toHaveClass('text-red-500');
      expect(title).toHaveClass('font-medium');
    });
  });
});

describe('AlertDescription', () => {
  describe('Basic Rendering', () => {
    it('should render as div element', () => {
      render(<AlertDescription>Description</AlertDescription>);
      const desc = screen.getByText('Description');
      expect(desc.tagName.toLowerCase()).toBe('div');
    });

    it('should render children', () => {
      render(<AlertDescription>Alert description text</AlertDescription>);
      expect(screen.getByText('Alert description text')).toBeInTheDocument();
    });

    it('should apply base classes', () => {
      render(<AlertDescription>Description</AlertDescription>);
      const desc = screen.getByText('Description');
      expect(desc).toHaveClass('text-sm');
    });

    it('should support ref forwarding', () => {
      const ref = React.createRef<HTMLParagraphElement>();
      render(<AlertDescription ref={ref}>Description</AlertDescription>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Custom className', () => {
    it('should merge custom className', () => {
      render(<AlertDescription className="mt-4">Description</AlertDescription>);
      const desc = screen.getByText('Description');
      expect(desc).toHaveClass('mt-4');
      expect(desc).toHaveClass('text-sm');
    });
  });
});

describe('Alert Composition', () => {
  it('should render complete alert with title and description', () => {
    render(
      <Alert>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>You can add components and dependencies.</AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Heads up!')).toBeInTheDocument();
    expect(screen.getByText('You can add components and dependencies.')).toBeInTheDocument();
  });

  it('should render destructive alert with icon', () => {
    const ErrorIcon = () => <svg data-testid="error-icon" />;
    render(
      <Alert variant="destructive">
        <ErrorIcon />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong.</AlertDescription>
      </Alert>
    );

    expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('text-destructive');
  });

  it('should render warning alert', () => {
    const WarningIcon = () => <svg data-testid="warning-icon" />;
    render(
      <Alert variant="warning">
        <WarningIcon />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Please review your input.</AlertDescription>
      </Alert>
    );

    expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('text-warning-foreground');
  });
});

describe('Accessibility', () => {
  it('Alert should be announced by screen readers', () => {
    render(<Alert>Important message</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  it('AlertTitle should have proper heading semantics', () => {
    render(
      <Alert>
        <AlertTitle>Important Title</AlertTitle>
      </Alert>
    );
    const heading = screen.getByText('Important Title');
    expect(heading.tagName.toLowerCase()).toBe('h5');
  });

  it('should support aria attributes', () => {
    render(
      <Alert aria-live="polite" aria-atomic="true">
        Live update
      </Alert>
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
  });
});
