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

import TermsPage from '../(legal)/terms/page';

describe('TermsPage', () => {
  it('should render with LegalPageLayout', () => {
    render(<TermsPage />);
    expect(screen.getByTestId('legal-page-layout')).toBeInTheDocument();
  });

  it('should pass correct title key (termsTitle)', () => {
    render(<TermsPage />);
    expect(screen.getByText('termsTitle')).toBeInTheDocument();
  });

  it('should pass subtitle and intro keys', () => {
    render(<TermsPage />);
    expect(screen.getByText('termsSubtitle')).toBeInTheDocument();
    expect(screen.getByText('termsIntro')).toBeInTheDocument();
  });

  it('should render all 12 sections', () => {
    render(<TermsPage />);
    expect(screen.getByText('termsSections.acceptance')).toBeInTheDocument();
    expect(screen.getByText('termsSections.serviceDescription')).toBeInTheDocument();
    expect(screen.getByText('termsSections.accounts')).toBeInTheDocument();
    expect(screen.getByText('termsSections.subscriptions')).toBeInTheDocument();
    expect(screen.getByText('termsSections.financialDisclaimer')).toBeInTheDocument();
    expect(screen.getByText('termsSections.intellectualProperty')).toBeInTheDocument();
    expect(screen.getByText('termsSections.userConduct')).toBeInTheDocument();
    expect(screen.getByText('termsSections.thirdPartyServices')).toBeInTheDocument();
    expect(screen.getByText('termsSections.liability')).toBeInTheDocument();
    expect(screen.getByText('termsSections.jurisdiction')).toBeInTheDocument();
    expect(screen.getByText('termsSections.termination')).toBeInTheDocument();
    expect(screen.getByText('termsSections.changes')).toBeInTheDocument();
  });
});
