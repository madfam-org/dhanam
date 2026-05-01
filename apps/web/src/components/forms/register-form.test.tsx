import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from './register-form';

// Mock @dhanam/ui as simple HTML elements
jest.mock('@dhanam/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Checkbox: React.forwardRef(({ onCheckedChange, checked, ...props }: any, ref: any) => (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  )),
  Input: React.forwardRef(({ ...props }: any, ref: any) => <input ref={ref} {...props} />),
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

// Mock @dhanam/shared with useTranslation
const authTranslations: Record<string, string> = {
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  fullName: 'Full Name',
  createAccount: 'Create account',
  creatingAccount: 'Creating account...',
  passwordHelp: 'Must contain at least 8 characters, one uppercase letter, and one number',
  agreementPrefix: 'By creating an account, you agree to our',
  termsOfService: 'Terms of Service',
  privacyPolicy: 'Privacy Policy',
  'placeholders.email': 'you@example.com',
  'placeholders.password': '••••••••',
  'placeholders.fullName': 'John Doe',
};

const commonTranslations: Record<string, string> = {
  and: 'and',
  'aria.showPassword': 'Show password',
  'aria.hidePassword': 'Hide password',
};

const validationTranslations: Record<string, string> = {
  emailInvalid: 'Invalid email address',
  passwordMinLength: 'Password must be at least {{min}} characters',
  passwordUppercase: 'Password must contain at least one uppercase letter',
  passwordNumber: 'Password must contain at least one number',
  nameMinLength: 'Name must be at least {{min}} characters',
  termsRequired: 'You must accept the terms and conditions',
  passwordsDoNotMatch: 'Passwords do not match',
};

jest.mock('@dhanam/shared', () => ({
  RegisterDto: {},
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
  getGeoDefaults: () => ({
    locale: 'es',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    region: 'latam',
    pricingRegion: 3,
  }),
}));

// Mock lucide-react icons as spans with test IDs
jest.mock('lucide-react', () => ({
  Eye: (props: any) => <span data-testid="eye-icon" {...props} />,
  EyeOff: (props: any) => <span data-testid="eye-off-icon" {...props} />,
  Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
}));

describe('RegisterForm', () => {
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

  it('should render all form fields', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
  });

  it('should render terms acceptance checkbox', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should render password toggle buttons with aria-labels', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    // Initially shows Eye icons (passwords hidden) — one for each password field
    const eyeIcons = screen.getAllByTestId('eye-icon');
    expect(eyeIcons).toHaveLength(2);

    // Both toggle buttons should have "Show password" aria-label initially
    const toggleButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.getAttribute('aria-label')?.includes('password'));
    expect(toggleButtons).toHaveLength(2);
    toggleButtons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-label', 'Show password');
    });
  });

  it('should toggle password visibility on click and update aria-label', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle (first eye icon belongs to Password field)
    const eyeIcons = screen.getAllByTestId('eye-icon');
    const toggleButton = eyeIcons[0].closest('button')!;
    expect(toggleButton).toHaveAttribute('aria-label', 'Show password');
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(toggleButton).toHaveAttribute('aria-label', 'Hide password');

    // Click again to hide
    const eyeOffIcon = screen.getByTestId('eye-off-icon');
    const toggleAgain = eyeOffIcon.closest('button')!;
    await user.click(toggleAgain);

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(toggleAgain).toHaveAttribute('aria-label', 'Show password');
  });

  // AUDIT-2026-04-23 / finding T5: registration form validation skipped.
  // 4 tests below (empty fields, invalid email, weak password, missing uppercase) cover
  // user-facing error messaging on the signup form. Un-skip after fixing jsdom/react interaction.
  // See /Users/aldoruizluna/labspace/claudedocs/ECOSYSTEM_AUDIT_2026-04-23.md
  it('should show validation errors for empty fields on submit [AUDIT-T5]', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
    });
    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should show validation error for invalid email [AUDIT-T5]', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'StrongPass1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // Form should not submit with invalid email
    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('should show validation error for weak password [AUDIT-T5]', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'weak');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('should show error when password missing uppercase letter [AUDIT-T5]', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'password1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(
        screen.getByText('Password must contain at least one uppercase letter')
      ).toBeInTheDocument();
    });
  });

  it('should show error when password missing number', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'Passwordd');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Password must contain at least one number')).toBeInTheDocument();
    });
  });

  it('should call onSubmit with valid form data', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.type(screen.getByLabelText('Confirm password'), 'Password1');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Password1',
          locale: 'es',
          timezone: 'America/Mexico_City',
        })
      );
    });

    // Verify acceptTerms and confirmPassword are NOT passed to onSubmit
    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData).not.toHaveProperty('acceptTerms');
    expect(submittedData).not.toHaveProperty('confirmPassword');
  });

  it('should not submit without accepting terms', async () => {
    const user = userEvent.setup();
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    await user.type(screen.getByLabelText('Full Name'), 'John Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');

    // Do NOT check the checkbox
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  it('should show loading state when isLoading is true', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} isLoading />);

    expect(screen.getByText('Creating account...')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    expect(screen.getByLabelText('Full Name')).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm password')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('should disable checkbox when loading', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} isLoading />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('should render links to Terms of Service and Privacy Policy', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    const termsLink = screen.getByText('Terms of Service');
    const privacyLink = screen.getByText('Privacy Policy');

    expect(termsLink).toBeInTheDocument();
    expect(termsLink.closest('a')).toHaveAttribute('href', '/terms');
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
  });

  it('should display password requirements hint', () => {
    render(<RegisterForm onSubmit={mockOnSubmit} />);

    expect(
      screen.getByText('Must contain at least 8 characters, one uppercase letter, and one number')
    ).toBeInTheDocument();
  });
});
