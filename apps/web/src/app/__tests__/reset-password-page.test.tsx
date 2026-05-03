import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/ui', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, ...props }: any) => {
    // Support asChild by rendering children directly if it's a link
    if (props.asChild) {
      return <>{children}</>;
    }
    return <button {...props}>{children}</button>;
  },
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

const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

import ResetPasswordPage from '../(auth)/reset-password/page';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    // Reset search params
    mockSearchParams.delete('token');
  });

  it('should render expired link message when no token', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText('resetPassword')).toBeInTheDocument();
    expect(screen.getAllByText('resetLinkExpired').length).toBeGreaterThanOrEqual(1);
  });

  it('should render request new link button when no token', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('should render back to login link when no token', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('should render locale switcher', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('should render confirmation page when token is present', () => {
    mockSearchParams.set('token', 'test-token-123');

    render(<ResetPasswordPage />);

    // When a token is present, the page renders a confirmation view
    // (the redirect to Janua happens via window.location.href assignment)
    expect(screen.getByText('resetPassword')).toBeInTheDocument();
  });
});
