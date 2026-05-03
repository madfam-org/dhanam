import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/shared', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));

jest.mock('@dhanam/ui', () => ({
  Button: ({ children, asChild, ...props }: any) => {
    if (asChild) return <>{children}</>;
    return <button {...props}>{children}</button>;
  },
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: (props: any) => <span data-testid="arrow-left" {...props} />,
  ExternalLink: (props: any) => <span data-testid="external-link" {...props} />,
}));

jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
});

import DocsPage from '../(legal)/docs/page';

describe('DocsPage', () => {
  it('should render the docs page heading', () => {
    render(<DocsPage />);
    expect(screen.getByText('docsTitle')).toBeInTheDocument();
  });

  it('should render the docs description', () => {
    render(<DocsPage />);
    expect(screen.getByText('docsDescription')).toBeInTheDocument();
  });

  it('should render a link to the external API docs', () => {
    render(<DocsPage />);
    const link = screen.getByText('docsRedirect').closest('a');
    expect(link).toHaveAttribute('href', 'https://api.dhan.am/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render a back-to-home link', () => {
    render(<DocsPage />);
    const backLink = screen.getByText('backToHome').closest('a');
    expect(backLink).toHaveAttribute('href', '/');
  });
});
