import { render, screen } from '@testing-library/react';

import { DashboardNav } from './dashboard-nav';

// Mock @dhanam/shared (useTranslation with 'dashboard' namespace)
jest.mock('@dhanam/shared', () => {
  const sidebar: Record<string, string> = {
    dashboard: 'Dashboard',
    accounts: 'Accounts',
    transactions: 'Transactions',
    calendar: 'Calendar',
    budgets: 'Budgets',
    zeroBased: 'Zero-Based',
    goals: 'Goals',
    households: 'Households',
    estatePlanning: 'Estate Planning',
    analytics: 'Analytics',
    statistics: 'Statistics',
    trends: 'Trends',
    esgInsights: 'ESG Insights',
    gaming: 'Gaming',
    retirement: 'Retirement',
    scenarios: 'Scenarios',
    reports: 'Reports',
    billing: 'Billing',
    settings: 'Settings',
    wealth: 'Wealth',
    spaces: 'Spaces',
    help: 'Help',
  };
  const commonAria: Record<string, string> = {
    mainNavigation: 'Main navigation',
  };
  const resolve = (key: string, namespace?: string): string => {
    if (namespace === 'common') {
      const parts = key.split('.');
      if (parts[0] === 'aria' && parts[1]) return commonAria[parts[1]] ?? key;
      return key;
    }
    const parts = key.split('.');
    if (parts[0] === 'sidebar' && parts[1]) return sidebar[parts[1]] ?? key;
    return key;
  };
  return {
    useTranslation: (namespace?: string) => ({
      t: (key: string) => resolve(key, namespace),
      i18n: { language: 'en', changeLanguage: jest.fn() },
    }),
  };
});

const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('lucide-react', () => {
  const icon = (name: string) => {
    const Icon = (props: Record<string, unknown>) => (
      <span data-testid={`icon-${name}`} {...props} />
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    LayoutDashboard: icon('LayoutDashboard'),
    Wallet: icon('Wallet'),
    Receipt: icon('Receipt'),
    TrendingUp: icon('TrendingUp'),
    PiggyBank: icon('PiggyBank'),
    Settings: icon('Settings'),
    FileText: icon('FileText'),
    Leaf: icon('Leaf'),
    Target: icon('Target'),
    AlertTriangle: icon('AlertTriangle'),
    Users: icon('Users'),
    ScrollText: icon('ScrollText'),
    Landmark: icon('Landmark'),
    Gamepad2: icon('Gamepad2'),
    CreditCard: icon('CreditCard'),
    Calendar: icon('Calendar'),
    BarChart3: icon('BarChart3'),
    ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'),
    ArrowLeftRight: icon('ArrowLeftRight'),
  };
});

jest.mock('@dhanam/ui', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const mockDemoNavigation = {
  isDemoMode: false,
  demoHref: (path: string) => path,
  stripDemoPrefix: (path: string) => path,
};
jest.mock('~/lib/contexts/demo-navigation-context', () => ({
  useDemoNavigation: () => mockDemoNavigation,
}));

// Top-level links always visible (sub-items are collapsed under parents)
const expectedLinks = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Accounts', href: '/accounts' },
  { name: 'Transactions', href: '/transactions' },
  { name: 'Budgets', href: '/budgets' },
  { name: 'Goals', href: '/goals' },
  { name: 'Households', href: '/households' },
  { name: 'Estate Planning', href: '/estate-planning' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Gaming', href: '/gaming' },
  { name: 'Retirement', href: '/retirement' },
  { name: 'Scenarios', href: '/scenarios' },
  { name: 'Reports', href: '/reports' },
  { name: 'Billing', href: '/billing' },
  { name: 'Settings', href: '/settings' },
];

beforeEach(() => {
  mockUsePathname.mockReturnValue('/');
});

describe('DashboardNav', () => {
  it('renders a nav element with aria-label', () => {
    render(<DashboardNav />);

    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Main navigation');
  });

  it('renders all navigation links', () => {
    render(<DashboardNav />);

    for (const link of expectedLinks) {
      expect(screen.getByText(link.name)).toBeInTheDocument();
    }
  });

  it('each link points to the correct route', () => {
    render(<DashboardNav />);

    for (const link of expectedLinks) {
      const anchor = screen.getByText(link.name).closest('a');
      expect(anchor).toHaveAttribute('href', link.href);
    }
  });

  it('highlights the active link based on exact pathname match', () => {
    mockUsePathname.mockReturnValue('/accounts');
    render(<DashboardNav />);

    const activeLink = screen.getByText('Accounts').closest('a');
    expect(activeLink?.className).toContain('bg-primary/10');

    const inactiveLink = screen.getByText('Dashboard').closest('a');
    expect(inactiveLink?.className).not.toContain('bg-primary/10');
  });

  it('highlights the active link based on pathname prefix match', () => {
    mockUsePathname.mockReturnValue('/settings/profile');
    render(<DashboardNav />);

    const activeLink = screen.getByText('Settings').closest('a');
    expect(activeLink?.className).toContain('bg-primary/10');
  });

  it('does not highlight any link when pathname does not match', () => {
    mockUsePathname.mockReturnValue('/unknown-route');
    render(<DashboardNav />);

    for (const link of expectedLinks) {
      const anchor = screen.getByText(link.name).closest('a');
      expect(anchor?.className).not.toContain('bg-primary/10');
    }
  });

  describe('demo mode', () => {
    beforeEach(() => {
      mockDemoNavigation.isDemoMode = true;
      mockDemoNavigation.demoHref = (path: string) => `/demo${path}`;
      mockDemoNavigation.stripDemoPrefix = (path: string) =>
        path.startsWith('/demo') ? path.replace(/^\/demo/, '') || '/' : path;
    });

    afterEach(() => {
      mockDemoNavigation.isDemoMode = false;
      mockDemoNavigation.demoHref = (path: string) => path;
      mockDemoNavigation.stripDemoPrefix = (path: string) => path;
    });

    it('prefixes link hrefs with /demo', () => {
      mockUsePathname.mockReturnValue('/demo/dashboard');
      render(<DashboardNav />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('href', '/demo/dashboard');

      const accountsLink = screen.getByText('Accounts').closest('a');
      expect(accountsLink).toHaveAttribute('href', '/demo/accounts');
    });

    it('detects active state from /demo-prefixed pathname', () => {
      mockUsePathname.mockReturnValue('/demo/accounts');
      render(<DashboardNav />);

      const activeLink = screen.getByText('Accounts').closest('a');
      expect(activeLink?.className).toContain('bg-primary/10');

      const inactiveLink = screen.getByText('Dashboard').closest('a');
      expect(inactiveLink?.className).not.toContain('bg-primary/10');
    });
  });
});
