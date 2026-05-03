import { render, screen } from '@testing-library/react';
import React from 'react';

const mockUseAuth = jest.fn();
jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('./PremiumUpsell', () => ({
  PremiumUpsell: ({ feature }: { feature?: string }) => (
    <div data-testid="premium-upsell">Upgrade to access {feature}</div>
  ),
}));

import { PremiumGate } from './PremiumGate';

describe('PremiumGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
  });

  it('should render children when user has required tier', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com', subscriptionTier: 'essentials' },
    });
    render(
      <PremiumGate feature="Retirement">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByText('Premium Content')).toBeTruthy();
  });

  it('should render children when user has higher tier than required', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com', subscriptionTier: 'pro' },
    });
    render(
      <PremiumGate feature="Retirement" requiredTier="essentials">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByText('Premium Content')).toBeTruthy();
  });

  it('should show upsell when community user accesses essentials feature', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com', subscriptionTier: 'community' },
    });
    render(
      <PremiumGate feature="Retirement">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByTestId('premium-upsell')).toBeTruthy();
    expect(screen.queryByText('Premium Content')).toBeNull();
  });

  it('should show upsell when user has no subscription tier (defaults to community)', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com' },
    });
    render(
      <PremiumGate feature="Scenarios">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByTestId('premium-upsell')).toBeTruthy();
  });

  it('should grant access to demo users regardless of subscription tier', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'guest@dhanam.demo', subscriptionTier: 'community' },
    });
    render(
      <PremiumGate feature="Retirement">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByText('Premium Content')).toBeTruthy();
    expect(screen.queryByTestId('premium-upsell')).toBeNull();
  });

  it('should grant access to all demo personas', () => {
    const personas = [
      'guest@dhanam.demo',
      'maria@dhanam.demo',
      'carlos@dhanam.demo',
      'patricia@dhanam.demo',
      'diego@dhanam.demo',
    ];

    for (const email of personas) {
      mockUseAuth.mockReturnValue({
        user: { email, subscriptionTier: 'community' },
      });
      const { unmount } = render(
        <PremiumGate feature="Scenarios" requiredTier="pro">
          <div>Pro Content</div>
        </PremiumGate>
      );
      expect(screen.getByText('Pro Content')).toBeTruthy();
      unmount();
    }
  });

  it('should grant access to admin users regardless of subscription tier', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'admin@madfam.io', subscriptionTier: 'community', isAdmin: true },
    });
    render(
      <PremiumGate feature="Estate Planning" requiredTier="premium">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByText('Premium Content')).toBeTruthy();
    expect(screen.queryByTestId('premium-upsell')).toBeNull();
  });

  it('should not grant admin bypass when isAdmin is false', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com', subscriptionTier: 'community', isAdmin: false },
    });
    render(
      <PremiumGate feature="Estate Planning" requiredTier="premium">
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.queryByText('Premium Content')).toBeNull();
    expect(screen.getByTestId('premium-upsell')).toBeTruthy();
  });

  it('should render custom fallback when provided', () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'user@example.com', subscriptionTier: 'community' },
    });
    render(
      <PremiumGate feature="Retirement" fallback={<div>Custom Fallback</div>}>
        <div>Premium Content</div>
      </PremiumGate>
    );
    expect(screen.getByText('Custom Fallback')).toBeTruthy();
    expect(screen.queryByText('Premium Content')).toBeNull();
  });
});
