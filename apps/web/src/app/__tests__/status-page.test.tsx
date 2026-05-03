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

import StatusPage from '../(legal)/status/page';

describe('StatusPage', () => {
  it('should render the status page heading', () => {
    render(<StatusPage />);
    expect(screen.getByText('statusTitle')).toBeInTheDocument();
  });

  it('should render the status description', () => {
    render(<StatusPage />);
    expect(screen.getByText('statusDescription')).toBeInTheDocument();
  });

  it('should render a link to the external status page', () => {
    render(<StatusPage />);
    const link = screen.getByText('statusRedirect').closest('a');
    expect(link).toHaveAttribute('href', 'https://status.dhan.am');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should render a back-to-home link', () => {
    render(<StatusPage />);
    const backLink = screen.getByText('backToHome').closest('a');
    expect(backLink).toHaveAttribute('href', '/');
  });
});
