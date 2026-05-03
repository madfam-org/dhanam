import { render, screen } from '@testing-library/react';
import React from 'react';

import { LegalPageLayout } from './legal-page-layout';

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        backToHome: 'Back to Home',
        tableOfContents: 'Table of Contents',
        lastUpdated: `Last updated: ${params?.date || ''}`,
        questionsContact: 'If you have questions, contact us at',
      };
      return map[key] || key;
    },
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: (props: any) => <span data-testid="arrow-left" {...props} />,
}));

describe('LegalPageLayout', () => {
  const defaultProps = {
    title: 'Privacy Policy',
    subtitle: 'Aviso de Privacidad',
    intro: 'This policy describes how we collect and use data.',
    sections: [
      { title: 'Data Collection', content: 'We collect personal data.' },
      { title: 'Data Usage', content: 'We use data to provide services.' },
    ],
  };

  it('should render the title and subtitle', () => {
    render(<LegalPageLayout {...defaultProps} />);
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Aviso de Privacidad')).toBeInTheDocument();
  });

  it('should render the intro text', () => {
    render(<LegalPageLayout {...defaultProps} />);
    expect(
      screen.getByText('This policy describes how we collect and use data.')
    ).toBeInTheDocument();
  });

  it('should render table of contents with section links', () => {
    render(<LegalPageLayout {...defaultProps} />);
    expect(screen.getByText('Table of Contents')).toBeInTheDocument();
    expect(screen.getByText('Data Collection')).toBeInTheDocument();
    expect(screen.getByText('Data Usage')).toBeInTheDocument();
  });

  it('should render section content', () => {
    render(<LegalPageLayout {...defaultProps} />);
    expect(screen.getByText('We collect personal data.')).toBeInTheDocument();
    expect(screen.getByText('We use data to provide services.')).toBeInTheDocument();
  });

  it('should render back to home link', () => {
    render(<LegalPageLayout {...defaultProps} />);
    const link = screen.getByText('Back to Home');
    expect(link.closest('a')).toHaveAttribute('href', '/');
  });

  it('should render last updated date when provided', () => {
    render(<LegalPageLayout {...defaultProps} lastUpdated="2026-03-01" />);
    expect(screen.getByText('Last updated: 2026-03-01')).toBeInTheDocument();
  });

  it('should not render last updated when not provided', () => {
    render(<LegalPageLayout {...defaultProps} />);
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
  });

  it('should render subsections when provided', () => {
    const props = {
      ...defaultProps,
      sections: [
        {
          title: 'Cookies',
          content: 'We use cookies.',
          subsections: [
            { title: 'Essential', content: 'Required for functionality.' },
            { title: 'Analytics', content: 'Help us improve.' },
          ],
        },
      ],
    };
    render(<LegalPageLayout {...props} />);
    expect(screen.getByText('Essential')).toBeInTheDocument();
    expect(screen.getByText('Required for functionality.')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('should render contact email link', () => {
    render(<LegalPageLayout {...defaultProps} />);
    const emailLink = screen.getByText('legal@dhanam.com');
    expect(emailLink).toHaveAttribute('href', 'mailto:legal@dhanam.com');
  });
});
