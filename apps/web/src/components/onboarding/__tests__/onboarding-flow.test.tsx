import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock('@dhanam/ui', () => ({
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

const mockUseOnboarding = jest.fn();

jest.mock('../onboarding-provider', () => ({
  useOnboarding: () => mockUseOnboarding(),
}));

jest.mock('../onboarding-header', () => ({
  OnboardingHeader: () => <div data-testid="onboarding-header" />,
}));

jest.mock('../onboarding-progress', () => ({
  OnboardingProgress: () => <div data-testid="onboarding-progress" />,
}));

jest.mock('../steps/welcome-step', () => ({
  WelcomeStep: () => <div data-testid="welcome-step">Welcome</div>,
}));

jest.mock('../steps/email-verification-step', () => ({
  EmailVerificationStep: () => <div>Email Verification</div>,
}));

jest.mock('../steps/preferences-step', () => ({
  PreferencesStep: () => <div>Preferences</div>,
}));

jest.mock('../steps/space-setup-step', () => ({
  SpaceSetupStep: () => <div>Space Setup</div>,
}));

jest.mock('../steps/connect-accounts-step', () => ({
  ConnectAccountsStep: () => <div>Connect Accounts</div>,
}));

jest.mock('../steps/first-budget-step', () => ({
  FirstBudgetStep: () => <div>First Budget</div>,
}));

jest.mock('../steps/feature-tour-step', () => ({
  FeatureTourStep: () => <div>Feature Tour</div>,
}));

jest.mock('../steps/completion-step', () => ({
  CompletionStep: () => <div>Completed</div>,
}));

import { OnboardingFlow } from '../onboarding-flow';

describe('OnboardingFlow', () => {
  it('should show loading state', () => {
    mockUseOnboarding.mockReturnValue({
      status: null,
      isLoading: true,
      error: null,
      refreshStatus: jest.fn(),
    });

    const { container } = render(<OnboardingFlow />);

    // Loading spinner should be present
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('should show error state with retry button', () => {
    mockUseOnboarding.mockReturnValue({
      status: null,
      isLoading: false,
      error: 'Something went wrong',
      refreshStatus: jest.fn(),
    });

    render(<OnboardingFlow />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('should render welcome step as default', () => {
    mockUseOnboarding.mockReturnValue({
      status: { completed: false, currentStep: 'welcome' },
      isLoading: false,
      error: null,
      refreshStatus: jest.fn(),
    });

    render(<OnboardingFlow />);

    expect(screen.getByTestId('welcome-step')).toBeInTheDocument();
  });

  it('should redirect to dashboard when completed', () => {
    const mockPush = jest.fn();
    const useRouter = require('next/navigation').useRouter;
    useRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      prefetch: jest.fn(),
    });

    mockUseOnboarding.mockReturnValue({
      status: { completed: true, currentStep: 'completed' },
      isLoading: false,
      error: null,
      refreshStatus: jest.fn(),
    });

    render(<OnboardingFlow />);

    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
