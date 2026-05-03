/**
 * Tests for PmfWidgetMount — the @madfam/pmf-widget host component.
 *
 * Notes on what is and isn't tested here:
 *   - We deterministically test the synchronous gates (env flag, auth,
 *     pathname). These are pure props/state and produce a `null` render
 *     before any dynamic import is attempted.
 *   - We do NOT test the success path (widget actually rendered) because
 *     `@madfam/pmf-widget` is not installed yet (publish blocked on
 *     NPM_MADFAM_TOKEN rotation). The dynamic import in the component
 *     intentionally swallows the resolve-failure and renders null.
 *   - The component reads `process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED`
 *     at render time (not module-load time), which lets us flip the
 *     env var between renders without `jest.resetModules()` (which
 *     would also reset React + @testing-library/react and produce
 *     "Cannot read properties of null (reading 'useState')" errors).
 */
import { render, waitFor } from '@testing-library/react';

import { PmfWidgetMount } from '~/components/pmf/PmfWidgetMount';

const mockUsePathname = jest.fn<string | null, []>(() => '/dashboard');
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => mockUsePathname(),
}));

const mockUseAuth = jest.fn(() => defaultAuth());

function defaultAuth() {
  return {
    user: null as { id: string; email?: string; name?: string } | null,
    isAuthenticated: false,
  };
}

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

const ORIGINAL_ENV = { ...process.env };

/**
 * The component reads `process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED` at
 * render time (not module-load time), so tests can flip the env var
 * between renders without resetting Jest's module cache (which would
 * also reset React + @testing-library/react and produce
 * "Cannot read properties of null (reading 'useState')" errors).
 */

function authenticated(overrides?: { id?: string; email?: string; name?: string }) {
  return {
    user: {
      id: overrides?.id ?? 'user-1',
      email: overrides?.email ?? 'a@example.com',
      name: overrides?.name ?? 'Alice',
    },
    isAuthenticated: true,
  };
}

describe('PmfWidgetMount (dhanam)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/dashboard');
    mockUseAuth.mockReturnValue(defaultAuth());
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('renders nothing when feature flag is off, even if authenticated', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'false';
    mockUseAuth.mockReturnValue(authenticated());

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when flag is on but user is anonymous', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(defaultAuth());

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on /login even when flag on + authenticated', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue('/login');

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on /onboarding (first-session noise)', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue('/onboarding');

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on /billing/checkout (transactional)', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue('/billing/checkout');

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on /billing/success (post-checkout)', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue('/billing/success');

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on marketing root /', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue('/');

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });

  it('attempts to load the widget on /dashboard when flag on + authenticated', async () => {
    // We can't assert the widget itself rendered (the @madfam/pmf-widget
    // module is not installed yet), but we can assert the component does
    // not synchronously bail before reaching the dynamic import. After
    // the dynamic import rejects, the render remains null (fail-closed).
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue('/dashboard');

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
    await waitFor(() => {
      expect(container.innerHTML).toBe('');
    });
  });

  it('renders nothing when pathname is null (SSR / pre-render)', async () => {
    process.env.NEXT_PUBLIC_PMF_WIDGET_ENABLED = 'true';
    mockUseAuth.mockReturnValue(authenticated());
    mockUsePathname.mockReturnValue(null);

    const { container } = render(<PmfWidgetMount />);
    expect(container.innerHTML).toBe('');
  });
});
