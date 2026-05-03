import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock all UI components
jest.mock('@dhanam/ui', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
  CardDescription: ({ children }: any) => <p>{children}</p>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardFooter: ({ children }: any) => <div>{children}</div>,
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Separator: () => <hr />,
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

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({ setAuth: jest.fn() }),
}));

jest.mock('~/lib/api/auth', () => ({
  authApi: { login: jest.fn(), loginAsGuest: jest.fn() },
}));

jest.mock('~/lib/api/client', () => ({
  ApiError: class ApiError extends Error {},
}));

jest.mock('~/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    identifyUser: jest.fn(),
    track: jest.fn(),
  }),
}));

jest.mock('~/components/locale-switcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

jest.mock('@janua/react-sdk', () => ({
  SignIn: ({ redirectUrl }: any) => (
    <div data-testid="janua-sign-in" data-redirect-url={redirectUrl}>
      Janua Sign In
    </div>
  ),
}));

// next/dynamic: resolve the import factory synchronously in tests
jest.mock('next/dynamic', () => {
  return (loader: () => Promise<any>) => {
    let Comp: any = () => null;
    // The loader is () => import('@janua/react-sdk').then(mod => mod.SignIn)
    // In test env with jest mocks, require resolves synchronously
    loader()
      .then((resolved: any) => {
        Comp = resolved;
      })
      .catch(() => {});
    // Return a wrapper that renders whatever the loader resolved
    const DynamicWrapper = (props: any) => {
      // Fallback: try to get SignIn from the mock directly
      if (Comp === null || Comp === undefined) {
        const mock = jest.requireMock('@janua/react-sdk');
        Comp = mock.SignIn || mock.SignUp || (() => null);
      }
      return <Comp {...props} />;
    };
    return DynamicWrapper;
  };
});

import LoginPage from '../(auth)/login/page';

describe('LoginPage', () => {
  it('should render the Janua SignIn component', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('janua-sign-in')).toBeInTheDocument();
    expect(screen.getByTestId('janua-sign-in')).toHaveAttribute('data-redirect-url', '/dashboard');
  });

  it('should render locale switcher', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('should render demo button', () => {
    render(<LoginPage />);

    expect(screen.getByText('tryDemo')).toBeInTheDocument();
  });

  it('should render sign up link', () => {
    render(<LoginPage />);

    expect(screen.getByText('signUp')).toBeInTheDocument();
  });

  it('should render forgot password link', () => {
    render(<LoginPage />);

    expect(screen.getByText('forgotPassword')).toBeInTheDocument();
  });
});
