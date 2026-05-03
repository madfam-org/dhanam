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

import SecurityPage from '../(legal)/security/page';

describe('SecurityPage', () => {
  it('should render with LegalPageLayout', () => {
    render(<SecurityPage />);
    expect(screen.getByTestId('legal-page-layout')).toBeInTheDocument();
  });

  it('should pass correct title key (securityTitle)', () => {
    render(<SecurityPage />);
    expect(screen.getByText('securityTitle')).toBeInTheDocument();
  });

  it('should pass subtitle and intro keys', () => {
    render(<SecurityPage />);
    expect(screen.getByText('securitySubtitle')).toBeInTheDocument();
    expect(screen.getByText('securityIntro')).toBeInTheDocument();
  });

  it('should render all 8 sections', () => {
    render(<SecurityPage />);
    expect(screen.getByText('securitySections.overview')).toBeInTheDocument();
    expect(screen.getByText('securitySections.encryption')).toBeInTheDocument();
    expect(screen.getByText('securitySections.authentication')).toBeInTheDocument();
    expect(screen.getByText('securitySections.infrastructure')).toBeInTheDocument();
    expect(screen.getByText('securitySections.monitoring')).toBeInTheDocument();
    expect(screen.getByText('securitySections.dataAccess')).toBeInTheDocument();
    expect(screen.getByText('securitySections.responsibleDisclosure')).toBeInTheDocument();
    expect(screen.getByText('securitySections.compliance')).toBeInTheDocument();
  });
});
