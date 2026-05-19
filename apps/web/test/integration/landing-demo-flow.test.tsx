import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HomePage from '@/app/page';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { authApi } from '@/lib/api/auth';
import { useRouter } from 'next/navigation';

// Mock dependencies
jest.mock('@/lib/hooks/use-auth');
jest.mock('@/hooks/useAnalytics');
jest.mock('@/lib/api/auth');
jest.mock('@dhanam/shared', () => {
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { landing } = require('../../../../packages/shared/src/i18n/en');
  const resolve = (obj: any, path: string): string => {
    const val = path.split('.').reduce((o: any, k: string) => o?.[k], obj);
    return typeof val === 'string' ? val : path;
  };
  const I18nContext = React.createContext({
    locale: 'en',
    translations: { en: { landing } },
    changeLanguage: jest.fn(),
  });
  return {
    useTranslation: () => ({
      t: (key: string) => resolve(landing, key),
      i18n: { language: 'en', changeLanguage: jest.fn() },
    }),
    I18nContext,
    I18nProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        I18nContext.Provider,
        {
          value: { locale: 'en', translations: { en: { landing } }, changeLanguage: jest.fn() },
        },
        children
      ),
  };
});

const mockSetAuth = jest.fn();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth> & {
  getState: jest.MockedFunction<() => { setAuth: jest.MockedFunction<any> }>;
};
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Landing Page Demo Flow', () => {
  const mockRouterPush = jest.fn();
  const mockAnalytics = {
    track: jest.fn(),
    trackPageView: jest.fn(),
    identify: jest.fn(),
  };

  const mockGuestUser = {
    id: 'guest-123',
    email: 'guest@dhanam.demo',
    name: 'Guest User',
    locale: 'en' as const,
    timezone: 'UTC',
    emailVerified: true,
    onboardingCompleted: true,
  };

  const mockGuestTokens = {
    accessToken: 'guest-access-token',
    refreshToken: 'guest-refresh-token',
    expiresIn: 3600,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup router mock
    mockUseRouter.mockReturnValue({
      push: mockRouterPush,
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    } as any);

    // Setup analytics mock
    mockUseAnalytics.mockReturnValue(mockAnalytics as any);

    // Setup Zustand store mock with getState
    mockUseAuth.getState = jest.fn().mockReturnValue({
      setAuth: mockSetAuth,
      user: null,
      isAuthenticated: false,
    });

    // Default: unauthenticated user
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      setAuth: mockSetAuth,
    } as any);
  });

  describe('Landing Page Rendering', () => {
    it('should render the landing page with hero section', () => {
      render(<HomePage />);

      expect(screen.getAllByText(/Your Entire Financial Life/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/One Platform/i)).toBeInTheDocument();
    });

    it('should render "Try Live Demo" button', () => {
      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      expect(demoButtons.length).toBeGreaterThan(0);
    });

    it('should render "Create Free Account" button', () => {
      render(<HomePage />);

      const signUpButtons = screen.getAllByRole('button', { name: /Create Free Account/i });
      expect(signUpButtons.length).toBeGreaterThan(0);
    });

    it('should show demo benefits text', () => {
      render(<HomePage />);

      expect(screen.getByText(/Instant access/i)).toBeInTheDocument();
    });
  });

  describe('Demo Flow Interaction', () => {
    it('should track analytics when "Try Live Demo" is clicked', async () => {
      mockAuthApi.loginAsGuest.mockResolvedValue({
        user: mockGuestUser,
        tokens: mockGuestTokens,
        message: 'Guest session created',
      });

      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      await waitFor(() => {
        expect(mockAnalytics.track).toHaveBeenCalledWith('live_demo_clicked', {
          source: 'hero_cta',
        });
      });
    });

    it('should call guest authentication API when demo button is clicked', async () => {
      mockAuthApi.loginAsGuest.mockResolvedValue({
        user: mockGuestUser,
        tokens: mockGuestTokens,
        message: 'Guest session created',
      });

      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      await waitFor(() => {
        expect(mockAuthApi.loginAsGuest).toHaveBeenCalled();
      });
    });

    it('should set auth after successful guest login', async () => {
      mockAuthApi.loginAsGuest.mockResolvedValue({
        user: mockGuestUser,
        tokens: mockGuestTokens,
        message: 'Guest session created',
      });

      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      // Verify auth is set (navigation happens via window.location which jsdom doesn't support)
      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith(mockGuestUser, mockGuestTokens);
      });
    });

    it('should track demo session start analytics', async () => {
      mockAuthApi.loginAsGuest.mockResolvedValue({
        user: mockGuestUser,
        tokens: mockGuestTokens,
        message: 'Guest session created',
      });

      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      await waitFor(() => {
        expect(mockAnalytics.track).toHaveBeenCalledWith('demo_session_started', {
          userId: mockGuestUser.id,
          expiresAt: expect.any(Date),
        });
      });
    });

    it('should track analytics on guest login failure', async () => {
      mockAuthApi.loginAsGuest.mockRejectedValue(new Error('Guest login failed'));

      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      // Verify failure is tracked (fallback navigation via window.location which jsdom doesn't support)
      await waitFor(() => {
        expect(mockAnalytics.track).toHaveBeenCalledWith('demo_session_failed', {
          error: 'Error: Guest login failed',
        });
      });
    });
  });

  describe('Sign Up Flow', () => {
    it('should track analytics when "Create Free Account" is clicked', () => {
      render(<HomePage />);

      const signUpButtons = screen.getAllByRole('button', { name: /Create Free Account/i });
      fireEvent.click(signUpButtons[0]!);

      // Verify analytics is tracked (navigation via window.location which jsdom doesn't support)
      expect(mockAnalytics.track).toHaveBeenCalledWith('signup_clicked', {
        source: 'landing_cta',
      });
    });
  });

  describe('Authenticated User Redirect', () => {
    it('should not track page view for authenticated users (as they are redirected)', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'user@example.com', name: 'User' } as any,
        isAuthenticated: true,
      } as any);

      render(<HomePage />);

      // Authenticated users are redirected, so no page view tracked
      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should track page view for unauthenticated users', () => {
      render(<HomePage />);

      // Unauthenticated users stay on landing page
      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('Landing Page', '/');
    });
  });

  describe('Feature Sections', () => {
    it('should render features grid', () => {
      render(<HomePage />);

      expect(screen.getByText(/Multi-Provider Banking/i)).toBeInTheDocument();
      expect(screen.getByText(/DeFi & Web3/i)).toBeInTheDocument();
      expect(screen.getByText(/Smart Categorization/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Estate Planning/i).length).toBeGreaterThan(0);
    });

    it('should render pricing section', () => {
      render(<HomePage />);

      expect(screen.getByText(/Plans for Every Stage/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Community/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Pro/i).length).toBeGreaterThan(0);
    });

    it('should render social proof section', () => {
      render(<HomePage />);

      expect(screen.getByText(/Integrated With the Platforms You Trust/i)).toBeInTheDocument();
      expect(screen.getByText(/Open Source ESG Methodology/i)).toBeInTheDocument();
    });
  });

  describe('Multiple CTA Buttons', () => {
    it('should have multiple "Try Live Demo" CTAs throughout the page', () => {
      render(<HomePage />);

      // Should have at least 2 demo buttons (hero + bottom CTA)
      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      expect(demoButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('should have all demo buttons trigger the same flow', async () => {
      mockAuthApi.loginAsGuest.mockResolvedValue({
        user: mockGuestUser,
        tokens: mockGuestTokens,
        message: 'Guest session created',
      });

      render(<HomePage />);

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });

      // Click the second demo button (bottom CTA)
      fireEvent.click(demoButtons[1]!);

      await waitFor(() => {
        expect(mockAuthApi.loginAsGuest).toHaveBeenCalled();
      });
    });
  });
});
