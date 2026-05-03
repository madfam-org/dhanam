import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LoginForm } from './login-form';

// Mock @dhanam/ui components
jest.mock('@dhanam/ui', () => ({
  Button: React.forwardRef(({ children, ...props }: any, ref: any) => (
    <button ref={ref} {...props}>
      {children}
    </button>
  )),
  Input: React.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

// Mock @dhanam/shared with useTranslation
const authTranslations: Record<string, string> = {
  email: 'Email',
  password: 'Password',
  totpCode: 'TOTP code',
  loginButton: 'Sign in',
  signingIn: 'Signing in...',
  'placeholders.email': 'you@example.com',
  'placeholders.password': '••••••••',
  'placeholders.totpCode': '123456',
};

const commonTranslations: Record<string, string> = {
  'aria.showPassword': 'Show password',
  'aria.hidePassword': 'Hide password',
};

const validationTranslations: Record<string, string> = {
  emailInvalid: 'Invalid email address',
  passwordMinLength: 'Password must be at least {{min}} characters',
};

jest.mock('@dhanam/shared', () => ({
  LoginDto: {},
  useTranslation: (namespace?: string) => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const map =
        namespace === 'validations'
          ? validationTranslations
          : namespace === 'common'
            ? commonTranslations
            : authTranslations;
      let value = map[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(`{{${k}}}`, String(v));
        });
      }
      return value;
    },
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Eye: ({ ...props }: any) => <span data-testid="eye-icon" {...props} />,
  EyeOff: ({ ...props }: any) => <span data-testid="eye-off-icon" {...props} />,
  Loader2: ({ ...props }: any) => <span data-testid="loader-icon" {...props} />,
}));

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeAll(() => {
    // Mock scrollIntoView as react-hook-form uses it for focus management on error
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should render the login form with email and password fields', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('should toggle password visibility when clicking the eye button', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByTestId('eye-icon')).toBeInTheDocument();

    // Click toggle to show password
    const toggleButton = passwordInput.parentElement!.querySelector('button')!;
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

    // Click toggle to hide password again
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
  });

  // AUDIT-2026-04-23 T5 resolved: un-skipped, swapped to userEvent.click
  // which goes through jsdom's synthetic event path (fireEvent.click
  // did not propagate through react-hook-form's async resolver here).
  it('should show validation errors for empty fields on submit [AUDIT-T5]', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit with form data when valid', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'securepassword123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'securepassword123',
        }),
        expect.anything()
      );
    });
  });

  it('should show loading state during submission', () => {
    render(<LoginForm onSubmit={mockOnSubmit} isLoading={true} />);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
  });

  it('should show TOTP field when showTotpField is true', () => {
    render(<LoginForm onSubmit={mockOnSubmit} showTotpField={true} />);

    expect(screen.getByLabelText('TOTP code')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('123456')).toBeInTheDocument();
  });

  it('should not show TOTP field by default', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(screen.queryByLabelText('TOTP code')).not.toBeInTheDocument();
  });
});
