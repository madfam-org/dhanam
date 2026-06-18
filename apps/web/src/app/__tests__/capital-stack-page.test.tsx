import { render, screen } from '@testing-library/react';
import React from 'react';

jest.mock(
  '@dhanam/ui',
  () =>
    new Proxy(
      {},
      {
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          if (prop === 'cn') return (...args: string[]) => args.filter(Boolean).join(' ');
          return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
            <div data-testid={String(prop).toLowerCase()} {...props}>
              {children}
            </div>
          );
        },
      }
    )
);

jest.mock('@dhanam/ui/patterns/basketweave.css', () => ({}));

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
        get: (_, prop) => {
          if (prop === '__esModule') return true;
          return (props: Record<string, unknown>) => (
            <span data-testid={`icon-${String(prop)}`} {...props} />
          );
        },
      }
    )
);

const mockGroups = [
  {
    id: 'group-1',
    name: 'Innovaciones MADFAM',
    type: 'owner_operator',
    baseCurrency: 'MXN',
    spaces: [
      { id: 's1', name: 'Aldo Personal', type: 'personal' },
      { id: 's2', name: 'Innovaciones MADFAM', type: 'business' },
    ],
    beneficialOwner: { id: 'u1', name: 'Aldo', email: 'aldo@madfam.io' },
  },
];

jest.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'capital-stack-groups') {
      return { data: mockGroups, isLoading: false, isError: false, refetch: jest.fn() };
    }
    if (queryKey[0] === 'capital-stack-dashboard') {
      return {
        data: {
          entityGroup: mockGroups[0],
          metrics: {
            journalByStatus: { draft: 1 },
            unreconciledFlows: 2,
            ownerFacilityAccountCount: 18,
          },
        },
        isLoading: false,
        isFetching: false,
        refetch: jest.fn(),
      };
    }
    if (queryKey[0] === 'capital-stack-accounts') {
      return { data: [], isLoading: false, refetch: jest.fn() };
    }
    return { data: [], isLoading: false, refetch: jest.fn() };
  },
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import CapitalStackPage from '../(dashboard)/capital-stack/page';

describe('CapitalStackPage', () => {
  it('renders entity group cockpit with metrics', () => {
    render(<CapitalStackPage />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getAllByText('Innovaciones MADFAM').length).toBeGreaterThan(0);
    expect(screen.getByText('metrics.unreconciled')).toBeInTheDocument();
    expect(screen.getByText('journal.title')).toBeInTheDocument();
  });
});
