import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CookieConsentBanner } from './cookie-consent-banner';

jest.mock('@dhanam/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'cookieConsent.message':
          'We use cookies to analyze site usage and improve your experience.',
        'cookieConsent.accept': 'Accept',
        'cookieConsent.reject': 'Reject',
        'cookieConsent.learnMore': 'Learn more',
      };
      return map[key] || key;
    },
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

const mockOptIn = jest.fn();
const mockOptOut = jest.fn();
jest.mock('~/lib/posthog', () => ({
  optInPostHog: () => mockOptIn(),
  optOutPostHog: () => mockOptOut(),
}));

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/');
  });
}

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    clearCookies();
    mockOptIn.mockClear();
    mockOptOut.mockClear();
  });

  it('should render when no consent cookie exists', () => {
    render(<CookieConsentBanner />);
    expect(screen.getByText(/We use cookies/)).toBeInTheDocument();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('should not render when consent is already accepted', () => {
    document.cookie = 'dhanam_consent=accepted;path=/';
    render(<CookieConsentBanner />);
    expect(screen.queryByText(/We use cookies/)).not.toBeInTheDocument();
  });

  it('should not render when consent is already rejected', () => {
    document.cookie = 'dhanam_consent=rejected;path=/';
    render(<CookieConsentBanner />);
    expect(screen.queryByText(/We use cookies/)).not.toBeInTheDocument();
  });

  it('should set accepted cookie and call optInPostHog on accept', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner />);

    await user.click(screen.getByText('Accept'));

    expect(document.cookie).toContain('dhanam_consent=accepted');
    expect(mockOptIn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/We use cookies/)).not.toBeInTheDocument();
  });

  it('should set rejected cookie and call optOutPostHog on reject', async () => {
    const user = userEvent.setup();
    render(<CookieConsentBanner />);

    await user.click(screen.getByText('Reject'));

    expect(document.cookie).toContain('dhanam_consent=rejected');
    expect(mockOptOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/We use cookies/)).not.toBeInTheDocument();
  });

  it('should render learn more link pointing to /cookies', () => {
    render(<CookieConsentBanner />);
    const link = screen.getByText('Learn more');
    expect(link.closest('a')).toHaveAttribute('href', '/cookies');
  });
});
