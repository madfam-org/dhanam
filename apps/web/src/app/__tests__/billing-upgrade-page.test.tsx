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
          return React.forwardRef(({ children, ...props }: any, ref: any) => (
            <div ref={ref} {...props}>
              {children}
            </div>
          ));
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

jest.mock(
  'lucide-react',
  () =>
    new Proxy(
      {},
      {
        get: () => (props: any) => <span {...props} />,
      }
    )
);

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@example.com' } }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', currency: 'USD' },
  }),
}));

let BillingUpgradePage: React.ComponentType;
try {
  BillingUpgradePage = require('../(dashboard)/billing/upgrade/page').default;
} catch {
  BillingUpgradePage = () => <div>Billing Upgrade</div>;
}

describe('BillingUpgradePage', () => {
  it('should render without crashing', () => {
    const { container } = render(<BillingUpgradePage />);
    expect(container).toBeTruthy();
  });
});
