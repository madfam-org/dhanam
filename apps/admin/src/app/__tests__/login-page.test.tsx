import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams('from=%2Fmadfam-import'),
}));

jest.mock('@/lib/hooks/use-admin-auth', () => ({
  useAdminAuth: () => ({
    isAuthenticated: false,
    isAdmin: false,
    _hasHydrated: true,
  }),
}));

jest.mock('@janua/react-sdk', () => ({
  JanuaProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/auth/admin-janua-sign-in', () => ({
  AdminJanuaSignIn: ({ redirectTo }: { redirectTo: string }) => (
    <div data-testid="admin-janua-sign-in" data-redirect={redirectTo} />
  ),
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: React.ComponentProps<'span'>) => (
            <span data-testid={`icon-${String(prop)}`} {...props} />
          );
        },
      }
    )
);

import AdminLoginPage from '../login/page';

describe('AdminLoginPage', () => {
  it('renders operator auth shell and Janua sign-in', async () => {
    render(<AdminLoginPage />);

    expect(await screen.findByRole('heading', { name: 'Dhanam Admin' })).toBeInTheDocument();
    expect(screen.getByText('Operator console')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to sign in' })).toHaveAttribute('href', '#main');
    expect(screen.getByTestId('admin-janua-sign-in')).toHaveAttribute(
      'data-redirect',
      '/madfam-import'
    );
  });
});
