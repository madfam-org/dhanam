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
          return ({ children, ...props }: any) => (
            <div data-testid={String(prop).toLowerCase()} {...props}>
              {children}
            </div>
          );
        },
      }
    )
);

jest.mock('@dhanam/shared', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, params?: any) => key,
    locale: 'en',
    setLocale: jest.fn(),
    hasKey: () => true,
    getNamespace: () => ({}),
  }),
  TAG_COLORS: Array.from({ length: 16 }, (_, i) => `#${i.toString(16).padStart(6, '0')}`),
}));

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

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null, isLoading: false }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal', currency: 'USD' },
  }),
}));

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
    setAuth: jest.fn(),
  }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/test',
}));

jest.mock('~/lib/api/tags', () => ({
  tagsApi: {
    getTags: jest.fn(),
    createTag: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
  },
}));

import TagsSettingsPage from '../(dashboard)/settings/tags/page';

describe('TagsSettingsPage', () => {
  it('should render the Tags heading', () => {
    render(<TagsSettingsPage />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('should show Create Tag button', () => {
    render(<TagsSettingsPage />);
    // Multiple elements contain "Create Tag" (header button, dialog title, dialog submit)
    const elements = screen.getAllByText('Create Tag');
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('should show empty state when no tags exist', () => {
    render(<TagsSettingsPage />);
    expect(screen.getByText('No tags yet')).toBeInTheDocument();
  });
});
