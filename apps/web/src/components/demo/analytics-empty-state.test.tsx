import { render, screen } from '@testing-library/react';
import React from 'react';

import { AnalyticsEmptyState } from './analytics-empty-state';

describe('AnalyticsEmptyState', () => {
  it('should render title and description', () => {
    render(
      <AnalyticsEmptyState
        title="Test Analytics"
        description="Test analytics description"
        isDemoMode={false}
      />
    );

    expect(screen.getByText('Test Analytics')).toBeInTheDocument();
    expect(screen.getByText('Test analytics description')).toBeInTheDocument();
  });

  it('should render trending up icon', () => {
    const { container } = render(
      <AnalyticsEmptyState
        title="Test Analytics"
        description="Test description"
        isDemoMode={false}
      />
    );

    // Check for the icon container with muted background
    const iconContainer = container.querySelector('.bg-muted');
    expect(iconContainer).toBeInTheDocument();
  });

  it('should show demo mode message when isDemoMode is true', () => {
    render(
      <AnalyticsEmptyState
        title="Cashflow Forecast"
        description="Projected income and expenses"
        isDemoMode={true}
      />
    );

    expect(screen.getByText('Demo Data Loading')).toBeInTheDocument();
    expect(
      screen.getByText(/This feature shows rich analytics based on your financial history/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign up to see personalized forecasts!/)).toBeInTheDocument();
  });

  it('should show regular empty state message when isDemoMode is false', () => {
    render(
      <AnalyticsEmptyState
        title="Cashflow Forecast"
        description="Projected income and expenses"
        isDemoMode={false}
      />
    );

    expect(screen.getByText('Not Enough Data Yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Connect your accounts and add transactions to see analytics and forecasts/)
    ).toBeInTheDocument();
  });

  it('should show demo mode info box with appropriate message', () => {
    render(
      <AnalyticsEmptyState
        title="Portfolio Allocation"
        description="Asset distribution"
        isDemoMode={true}
      />
    );

    expect(
      screen.getByText(
        /This demo uses sample data. After signing up, you'll see real insights from your connected accounts./
      )
    ).toBeInTheDocument();
  });

  it('should show regular user info box with appropriate message', () => {
    render(
      <AnalyticsEmptyState
        title="Portfolio Allocation"
        description="Asset distribution"
        isDemoMode={false}
      />
    );

    expect(
      screen.getByText(
        /We need at least 30 days of transaction history to generate accurate forecasts/
      )
    ).toBeInTheDocument();
  });

  it('should render info icon in the info box', () => {
    const { container } = render(
      <AnalyticsEmptyState title="Test" description="Description" isDemoMode={false} />
    );

    // Check for info icon (lucide-react Info component)
    const infoBoxes = container.querySelectorAll('.text-info');
    expect(infoBoxes.length).toBeGreaterThan(0);
  });

  it('should apply correct styling to demo mode elements', () => {
    render(
      <AnalyticsEmptyState
        title="Test Analytics"
        description="Test description"
        isDemoMode={true}
      />
    );

    const strongText = screen.getByText(/Sign up to see personalized forecasts!/);
    expect(strongText.tagName).toBe('STRONG');
    expect(strongText.className).toContain('block');
  });

  it('should have proper card structure with header and content', () => {
    const { container } = render(
      <AnalyticsEmptyState
        title="Net Worth Trends"
        description="Historical wealth tracking"
        isDemoMode={false}
      />
    );

    // Check for Card structure (CardHeader and CardContent are rendered)
    expect(screen.getByText('Net Worth Trends')).toBeInTheDocument();
    expect(screen.getByText('Historical wealth tracking')).toBeInTheDocument();

    // Check for proper content structure
    const contentContainer = container.querySelector('.flex.flex-col.items-center');
    expect(contentContainer).toBeInTheDocument();
  });

  it('should render with different titles and descriptions', () => {
    const { rerender } = render(
      <AnalyticsEmptyState title="First Title" description="First Description" isDemoMode={false} />
    );

    expect(screen.getByText('First Title')).toBeInTheDocument();
    expect(screen.getByText('First Description')).toBeInTheDocument();

    rerender(
      <AnalyticsEmptyState
        title="Second Title"
        description="Second Description"
        isDemoMode={true}
      />
    );

    expect(screen.getByText('Second Title')).toBeInTheDocument();
    expect(screen.getByText('Second Description')).toBeInTheDocument();
  });

  it('should have proper accessibility structure', () => {
    render(
      <AnalyticsEmptyState
        title="Test Analytics"
        description="Test description"
        isDemoMode={false}
      />
    );

    // Titles should be in proper heading hierarchy
    // CardTitle renders as h3 by default in shadcn
    const titleElement = screen.getByText('Test Analytics');
    expect(titleElement).toBeInTheDocument();
  });

  it('should display consistent spacing and layout', () => {
    const { container } = render(
      <AnalyticsEmptyState title="Test" description="Description" isDemoMode={false} />
    );

    // Check for py-8 padding on content container
    const contentContainer = container.querySelector('.py-8');
    expect(contentContainer).toBeInTheDocument();

    // Check for text center alignment
    const centerAlignedContainer = container.querySelector('.text-center');
    expect(centerAlignedContainer).toBeInTheDocument();
  });
});
