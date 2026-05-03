import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/shared', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

jest.mock('~/components/legal/legal-page-layout', () => ({
  LegalPageLayout: ({ title, subtitle, intro, sections }: any) => (
    <div data-testid="legal-page-layout">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {intro && <p>{intro}</p>}
      {sections?.map((s: any, i: number) => (
        <div key={i}>
          <h2>{s.title}</h2>
          <p>{s.content}</p>
        </div>
      ))}
    </div>
  ),
}));

import CookiesPage from '../(legal)/cookies/page';

describe('CookiesPage', () => {
  it('should render with LegalPageLayout', () => {
    render(<CookiesPage />);
    expect(screen.getByTestId('legal-page-layout')).toBeInTheDocument();
  });

  it('should pass correct title key (cookiesTitle)', () => {
    render(<CookiesPage />);
    expect(screen.getByText('cookiesTitle')).toBeInTheDocument();
  });

  it('should pass subtitle and intro keys', () => {
    render(<CookiesPage />);
    expect(screen.getByText('cookiesSubtitle')).toBeInTheDocument();
    expect(screen.getByText('cookiesIntro')).toBeInTheDocument();
  });

  it('should render section titles', () => {
    render(<CookiesPage />);
    expect(screen.getByText('cookiesSections.whatAreCookies')).toBeInTheDocument();
    expect(screen.getByText('cookiesSections.cookiesWeUse')).toBeInTheDocument();
    expect(screen.getByText('cookiesSections.consentMechanism')).toBeInTheDocument();
    expect(screen.getByText('cookiesSections.thirdParty')).toBeInTheDocument();
    expect(screen.getByText('cookiesSections.managing')).toBeInTheDocument();
    expect(screen.getByText('cookiesSections.changes')).toBeInTheDocument();
  });
});
