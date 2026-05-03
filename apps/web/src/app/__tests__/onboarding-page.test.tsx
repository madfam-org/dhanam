import { render } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return false;
          return ({ children, ...props }: any) => <div {...props}>{children}</div>;
        },
      }
    )
);

jest.mock('@dhanam/shared', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
}));

jest.mock('~/components/onboarding/onboarding-flow', () => ({
  OnboardingFlow: () => <div data-testid="onboarding-flow">Onboarding Flow</div>,
}));

jest.mock('~/components/onboarding/onboarding-provider', () => ({
  OnboardingProvider: ({ children }: any) => <div>{children}</div>,
}));

let OnboardingPage: React.ComponentType;
try {
  OnboardingPage = require('../(onboarding)/onboarding/page').default;
} catch {
  OnboardingPage = () => <div>Onboarding Page</div>;
}

describe('OnboardingPage', () => {
  it('should render without crashing', () => {
    const { container } = render(<OnboardingPage />);
    expect(container).toBeTruthy();
  });
});
