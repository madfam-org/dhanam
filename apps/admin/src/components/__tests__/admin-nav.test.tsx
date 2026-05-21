import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import React from 'react';

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: any) => <span data-testid={`icon-${String(prop)}`} {...props} />;
        },
      }
    )
);

import { AdminNav } from '../admin-nav';

describe('AdminNav', () => {
  beforeEach(() => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
  });

  it('renders all nav section labels', () => {
    render(<AdminNav />);

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('SRE')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    // "Analytics" appears as both section label and link; match the section label specifically
    const analyticsLabels = screen.getAllByText('Analytics');
    expect(analyticsLabels.length).toBeGreaterThanOrEqual(1);
    const sectionLabel = analyticsLabels.find(
      (el) => el.tagName === 'P' && el.classList.contains('uppercase')
    );
    expect(sectionLabel).toBeTruthy();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
  });

  it('renders all nav link items', () => {
    render(<AdminNav />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Queues')).toBeInTheDocument();
    expect(screen.getByText('Providers')).toBeInTheDocument();
    expect(screen.getByText('Deployment')).toBeInTheDocument();
    expect(screen.getByText('Spaces')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    expect(screen.getByText('MADFAM POS')).toBeInTheDocument();
    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText('Billing Events')).toBeInTheDocument();
    // "Analytics" appears as both section label and link; match the nav link specifically
    const analyticsElements = screen.getAllByText('Analytics');
    const analyticsLink = analyticsElements.find((el) => el.closest('a') !== null);
    expect(analyticsLink).toBeTruthy();
    expect(screen.getByText('GDPR & Retention')).toBeInTheDocument();
  });

  it('applies active class to the link matching the current path', () => {
    (usePathname as jest.Mock).mockReturnValue('/queues');
    render(<AdminNav />);

    const queuesLink = screen.getByText('Queues').closest('a');
    expect(queuesLink).toHaveClass('bg-indigo-50');

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).not.toHaveClass('bg-indigo-50');
  });

  it('renders the Dashboard link pointing to /dashboard', () => {
    render(<AdminNav />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  it('renders the correct total number of nav items', () => {
    render(<AdminNav />);

    const allLinks = screen.getAllByRole('link').filter((link) => link.closest('nav'));
    // 1 (Overview) + 4 (SRE) + 3 (Data) + 2 (Commerce) + 2 (Analytics) + 1 (Compliance) = 13
    expect(allLinks).toHaveLength(13);
  });
});
