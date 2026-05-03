import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/ui', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Input: (props: any) => <input {...props} />,
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

jest.mock('~/components/locale-switcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

import ForgotPasswordPage from '../(auth)/forgot-password/page';

describe('ForgotPasswordPage', () => {
  it('should render the reset password form', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText('resetPasswordTitle')).toBeInTheDocument();
    expect(screen.getByText('resetPasswordSubtitle')).toBeInTheDocument();
  });

  it('should render email input', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render send reset link button', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText('sendResetLink')).toBeInTheDocument();
  });

  it('should render back to login link', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('should render locale switcher', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });
});
