import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  LandingHeroCapabilities,
  LandingHeroStatic,
} from '@/components/landing/landing-hero-static';
import { HeroProductPreview } from '@/components/landing/hero-product-preview';
import { LandingTrustStrip } from '@/components/landing/landing-trust-strip';
import { LandingPageClient } from '@/components/landing/landing-page-client';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { redirectToAppDemo } from '@/lib/demo/launch-demo';

jest.mock('@/lib/demo/launch-demo', () => ({
  ...jest.requireActual('@/lib/demo/launch-demo'),
  redirectToAppDemo: jest.fn(),
}));
jest.mock('@/lib/hooks/use-auth');
jest.mock('@/hooks/useAnalytics');
jest.mock('@/hooks/usePublicSurface', () => ({
  usePublicAppUrl: () => 'https://app.dhan.am',
  usePublicApiUrl: () => 'https://api.dhan.am/v1',
  usePublicAdminUrl: () => 'https://admin.dhan.am',
}));
jest.mock('~/components/billing/CheckoutPaymentRecommendations', () => ({
  CheckoutPaymentRecommendations: () => null,
}));
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
    getLandingTranslation: (locale: string, key: string) => resolve(landing, key),
    normalizeLandingLocale: (l: string) => l,
    LANDING_LOCALES: ['es', 'en', 'pt-BR'],
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth> & {
  getState: jest.MockedFunction<() => { setAuth: jest.MockedFunction<any> }>;
};
const mockUseAnalytics = useAnalytics as jest.MockedFunction<typeof useAnalytics>;
const mockRedirectToAppDemo = redirectToAppDemo as jest.MockedFunction<typeof redirectToAppDemo>;

function renderLanding() {
  return render(
    <LandingPageClient
      locale="en"
      heroColumn={
        <>
          <LandingHeroStatic locale="en" />
          <LandingTrustStrip locale="en" />
        </>
      }
      heroPreview={<HeroProductPreview />}
      heroCapabilities={<LandingHeroCapabilities locale="en" />}
    />
  );
}

describe('Landing Page Demo Flow', () => {
  const mockAnalytics = {
    track: jest.fn(),
    trackPageView: jest.fn(),
    identify: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAnalytics.mockReturnValue(mockAnalytics as any);

    mockUseAuth.getState = jest.fn().mockReturnValue({
      setAuth: jest.fn(),
      user: null,
      isAuthenticated: false,
    });

    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      setAuth: jest.fn(),
    } as any);
  });

  describe('Landing Page Rendering', () => {
    it('should render the landing page with hero section', () => {
      renderLanding();

      expect(screen.getByText(/Know where your money is going/i)).toBeInTheDocument();
    });

    it('should render "Try Live Demo" button', () => {
      renderLanding();

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      expect(demoButtons.length).toBeGreaterThan(0);
    });

    it('should render "Create Free Account" button', () => {
      renderLanding();

      const signUpButtons = screen.getAllByRole('button', { name: /Create Free Account/i });
      expect(signUpButtons.length).toBeGreaterThan(0);
    });

    it('should show demo benefits text', () => {
      renderLanding();

      expect(screen.getByText(/Instant access/i)).toBeInTheDocument();
    });

    it('should render persona cards section', () => {
      renderLanding();

      expect(screen.getByText(/Choose Your Adventure/i)).toBeInTheDocument();
    });

    it('should render security trust section', () => {
      renderLanding();

      expect(screen.getByText(/Security We Can Stand Behind/i)).toBeInTheDocument();
    });
  });

  describe('Demo Flow Interaction', () => {
    it('should track analytics when "Try Live Demo" is clicked', () => {
      renderLanding();

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      expect(mockAnalytics.track).toHaveBeenCalledWith('live_demo_clicked', {
        source: 'hero_cta',
        locale: 'en',
      });
    });

    it('should redirect to app demo launch URL when demo button is clicked', () => {
      renderLanding();

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      fireEvent.click(demoButtons[0]!);

      expect(mockRedirectToAppDemo).toHaveBeenCalledWith('https://app.dhan.am');
    });
  });

  describe('Sign Up Flow', () => {
    it('should track analytics when "Create Free Account" is clicked', () => {
      renderLanding();

      const signUpButtons = screen.getAllByRole('button', { name: /Create Free Account/i });
      fireEvent.click(signUpButtons[0]!);

      expect(mockAnalytics.track).toHaveBeenCalledWith('signup_clicked', {
        source: 'hero_cta',
        locale: 'en',
      });
    });
  });

  describe('Authenticated User Redirect', () => {
    it('should not track page view for authenticated users (as they are redirected)', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', email: 'user@example.com', name: 'User' } as any,
        isAuthenticated: true,
      } as any);

      renderLanding();

      expect(mockAnalytics.trackPageView).not.toHaveBeenCalled();
    });

    it('should track page view for unauthenticated users', () => {
      renderLanding();

      expect(mockAnalytics.trackPageView).toHaveBeenCalledWith('Landing Page', '/en');
    });
  });

  describe('Feature Sections', () => {
    it('should render features grid', () => {
      renderLanding();

      expect(screen.getByText(/Multi-Provider Banking/i)).toBeInTheDocument();
      expect(screen.getByText(/DeFi & Web3/i)).toBeInTheDocument();
    });

    it('should render pricing section', () => {
      renderLanding();

      expect(screen.getByText(/Plans for Every Stage/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Community/i).length).toBeGreaterThan(0);
    });

    it('should render social proof section', () => {
      renderLanding();

      expect(screen.getByText(/Integrated With the Platforms You Trust/i)).toBeInTheDocument();
    });
  });

  describe('Multiple CTA Buttons', () => {
    it('should have multiple "Try Live Demo" CTAs throughout the page', () => {
      renderLanding();

      const demoButtons = screen.getAllByRole('button', { name: /Try Live Demo/i });
      expect(demoButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
