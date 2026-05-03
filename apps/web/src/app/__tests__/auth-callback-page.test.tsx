import { render, screen } from '@testing-library/react';
import React from 'react';

const mockPush = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

const mockUseAuth = jest.fn();

jest.mock('@janua/react-sdk', () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

import AuthCallbackPage from '../auth/callback/page';

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGet.mockReturnValue(null);
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: false });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should render loading spinner while SDK processes callback', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: false });

    render(<AuthCallbackPage />);

    expect(screen.getByText('completingSignIn')).toBeInTheDocument();
    expect(screen.getByText('verifyingCredentials')).toBeInTheDocument();
  });

  it('should show error state when OAuth error param is present', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'error') return 'access_denied';
      if (key === 'error_description') return 'User denied access';
      return null;
    });

    render(<AuthCallbackPage />);

    expect(screen.getByText('signInFailed')).toBeInTheDocument();
    expect(screen.getByText('User denied access')).toBeInTheDocument();
  });

  it('should redirect to dashboard when SDK finishes authentication', () => {
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });

    render(<AuthCallbackPage />);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });

  it('should redirect to custom state path when provided', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'state') return '/onboarding';
      return null;
    });
    mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });

    render(<AuthCallbackPage />);

    expect(mockPush).toHaveBeenCalledWith('/onboarding');
  });

  it('should redirect to login with error on OAuth error after timeout', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'error') return 'server_error';
      if (key === 'error_description') return 'Internal server error';
      return null;
    });

    render(<AuthCallbackPage />);

    jest.advanceTimersByTime(2000);

    expect(mockPush).toHaveBeenCalledWith('/login?error=Internal%20server%20error');
  });
});
