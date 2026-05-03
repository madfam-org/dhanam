import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return ({ children, ...props }: any) => (
            <div data-testid={String(prop).toLowerCase()} {...props}>
              {children}
            </div>
          );
        },
      }
    )
);

jest.mock('@dhanam/shared', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, params?: any) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />;
        },
      }
    )
);

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
  }),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
    setAuth: jest.fn(),
  }),
}));

jest.mock('~/hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    track: jest.fn(),
    trackPageView: jest.fn(),
    trackViewNetWorth: jest.fn(),
    trackUpgradeCompleted: jest.fn(),
  }),
}));

jest.mock('@/components/onboarding/email-verification', () => ({
  EmailVerification: () => <div data-testid="email-verification">Email Verification Component</div>,
}));

import VerifyEmailPage from '../(onboarding)/verify-email/page';

describe('VerifyEmailPage', () => {
  it('should render the email verification component', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByTestId('email-verification')).toBeInTheDocument();
  });

  it('should render the component content', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText('Email Verification Component')).toBeInTheDocument();
  });

  it('should render without errors', () => {
    const { container } = render(<VerifyEmailPage />);
    expect(container.firstChild).toBeTruthy();
  });

  it('should not render any other components besides email verification', () => {
    const { container } = render(<VerifyEmailPage />);
    // The page should only contain the EmailVerification stub
    expect(container.querySelectorAll('[data-testid]')).toHaveLength(1);
  });
});
