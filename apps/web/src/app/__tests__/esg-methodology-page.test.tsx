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

import EsgMethodologyPage from '../(legal)/esg-methodology/page';

describe('EsgMethodologyPage', () => {
  it('should render with LegalPageLayout', () => {
    render(<EsgMethodologyPage />);
    expect(screen.getByTestId('legal-page-layout')).toBeInTheDocument();
  });

  it('should pass correct title key (esgTitle)', () => {
    render(<EsgMethodologyPage />);
    expect(screen.getByText('esgTitle')).toBeInTheDocument();
  });

  it('should pass subtitle and intro keys', () => {
    render(<EsgMethodologyPage />);
    expect(screen.getByText('esgSubtitle')).toBeInTheDocument();
    expect(screen.getByText('esgIntro')).toBeInTheDocument();
  });

  it('should render all 8 sections', () => {
    render(<EsgMethodologyPage />);
    expect(screen.getByText('esgSections.overview')).toBeInTheDocument();
    expect(screen.getByText('esgSections.sources')).toBeInTheDocument();
    expect(screen.getByText('esgSections.environmental')).toBeInTheDocument();
    expect(screen.getByText('esgSections.social')).toBeInTheDocument();
    expect(screen.getByText('esgSections.governance')).toBeInTheDocument();
    expect(screen.getByText('esgSections.composite')).toBeInTheDocument();
    expect(screen.getByText('esgSections.limitations')).toBeInTheDocument();
    expect(screen.getByText('esgSections.updates')).toBeInTheDocument();
  });
});
