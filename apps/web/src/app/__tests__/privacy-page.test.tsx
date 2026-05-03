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

import PrivacyPage from '../(legal)/privacy/page';

describe('PrivacyPage', () => {
  it('should render with LegalPageLayout', () => {
    render(<PrivacyPage />);
    expect(screen.getByTestId('legal-page-layout')).toBeInTheDocument();
  });

  it('should pass correct title key (privacyTitle)', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('privacyTitle')).toBeInTheDocument();
  });

  it('should pass subtitle and intro keys', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('privacySubtitle')).toBeInTheDocument();
    expect(screen.getByText('privacyIntro')).toBeInTheDocument();
  });

  it('should render all 11 sections', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('privacySections.dataController')).toBeInTheDocument();
    expect(screen.getByText('privacySections.dataCollected')).toBeInTheDocument();
    expect(screen.getByText('privacySections.purposes')).toBeInTheDocument();
    expect(screen.getByText('privacySections.legalBasis')).toBeInTheDocument();
    expect(screen.getByText('privacySections.arcoRights')).toBeInTheDocument();
    expect(screen.getByText('privacySections.dataTransfers')).toBeInTheDocument();
    expect(screen.getByText('privacySections.retention')).toBeInTheDocument();
    expect(screen.getByText('privacySections.security')).toBeInTheDocument();
    expect(screen.getByText('privacySections.cookies')).toBeInTheDocument();
    expect(screen.getByText('privacySections.changes')).toBeInTheDocument();
    expect(screen.getByText('privacySections.contact')).toBeInTheDocument();
  });
});
