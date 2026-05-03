import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DashboardHeader } from './dashboard-header';

// Mock @dhanam/shared (useTranslation with 'dashboard' namespace)
jest.mock('@dhanam/shared', () => {
  const translations: Record<string, string> = {
    'header.loading': 'Loading...',
    'header.selectSpace': 'Select Space',
    'header.yourSpaces': 'Your Spaces',
    'header.createNewSpace': 'Create New Space',
    'header.createFirstSpace': 'Create Your First Space',
    'header.settings': 'Settings',
    'header.adminDashboard': 'Admin Dashboard',
    'header.logout': 'Log Out',
  };
  return {
    useTranslation: () => ({
      t: (key: string) => translations[key] ?? key,
      i18n: { language: 'en', changeLanguage: jest.fn() },
    }),
  };
});

// Mock child components with complex dependencies
jest.mock('~/components/layout/mobile-sidebar', () => ({
  MobileSidebar: () => <div data-testid="mobile-sidebar" />,
}));
jest.mock('~/components/search/search-command', () => ({
  SearchCommand: () => <div data-testid="search-command" />,
}));
jest.mock('~/components/locale-switcher/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));
jest.mock('~/components/theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
jest.mock('~/components/layout/notification-dropdown', () => ({
  NotificationDropdown: () => (
    <div data-testid="notification-dropdown">
      <span data-testid="icon-bell">Bell</span>
    </div>
  ),
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock @dhanam/ui components
jest.mock('@dhanam/ui', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div role="menuitem" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Bell: () => <span data-testid="icon-bell">Bell</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  LogOut: () => <span data-testid="icon-logout">LogOut</span>,
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  Shield: () => <span data-testid="icon-shield">Shield</span>,
}));

// Mock @janua/react-sdk
jest.mock('@janua/react-sdk', () => ({
  UserButton: () => <div data-testid="janua-user-button">User Button</div>,
}));

// Mock hooks and stores
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockSetCurrentSpace = jest.fn();

jest.mock('~/lib/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      name: 'Aldo Ruiz',
      email: 'aldo@madfam.io',
      spaces: [{ role: 'owner' }],
    },
    logout: mockLogout,
  }),
}));

jest.mock('~/lib/hooks/use-spaces', () => ({
  useSpaces: () => ({
    data: [
      { id: 'space-1', name: 'Personal', type: 'personal' },
      { id: 'space-2', name: 'Business', type: 'business' },
    ],
    isLoading: false,
    isPlaceholderData: false,
  }),
}));

jest.mock('~/stores/space', () => ({
  useSpaceStore: () => ({
    currentSpace: { id: 'space-1', name: 'Personal', type: 'personal' },
    setCurrentSpace: mockSetCurrentSpace,
  }),
}));

const mockDemoNavigation = {
  isDemoMode: false,
  demoHref: (path: string) => path,
  stripDemoPrefix: (path: string) => path,
};
jest.mock('~/lib/contexts/demo-navigation-context', () => ({
  useDemoNavigation: () => mockDemoNavigation,
}));

describe('DashboardHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the header with user info and mobile sidebar', () => {
    render(<DashboardHeader />);

    expect(screen.getByText('Dhanam')).toBeInTheDocument();
    expect(screen.getByText('Aldo Ruiz')).toBeInTheDocument();
    expect(screen.getByText('aldo@madfam.io')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
  });

  it('should show the current space name in the selector', () => {
    render(<DashboardHeader />);

    expect(screen.getAllByText('Personal').length).toBeGreaterThanOrEqual(1);
  });

  it('should show available spaces in the dropdown', () => {
    render(<DashboardHeader />);

    expect(screen.getByText('Your Spaces')).toBeInTheDocument();
    expect(screen.getByText('Business')).toBeInTheDocument();
    expect(screen.getByText('Create New Space')).toBeInTheDocument();
  });

  it('should show logout menu item', () => {
    render(<DashboardHeader />);

    expect(screen.getByText('Log Out')).toBeInTheDocument();
    expect(screen.getByTestId('icon-logout')).toBeInTheDocument();
  });

  it('should show settings menu item', () => {
    render(<DashboardHeader />);

    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('icon-settings')).toBeInTheDocument();
  });

  it('should show admin dashboard link for admin/owner users', () => {
    render(<DashboardHeader />);

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('icon-shield')).toBeInTheDocument();
  });

  it('should handle logout action', async () => {
    const user = userEvent.setup();
    render(<DashboardHeader />);

    const logoutItem = screen.getByText('Log Out').closest('[role="menuitem"]')!;
    await user.click(logoutItem);

    expect(mockLogout).toHaveBeenCalled();
    // Wait for the async logout to complete and check redirect
    await new Promise((r) => setTimeout(r, 0));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('should handle space selection', async () => {
    const user = userEvent.setup();
    render(<DashboardHeader />);

    const businessSpace = screen.getByText('Business').closest('[role="menuitem"]')!;
    await user.click(businessSpace);

    expect(mockSetCurrentSpace).toHaveBeenCalledWith({
      id: 'space-2',
      name: 'Business',
      type: 'business',
    });
  });

  it('should render notification bell icon', () => {
    render(<DashboardHeader />);

    expect(screen.getByTestId('icon-bell')).toBeInTheDocument();
  });

  describe('demo mode navigation', () => {
    beforeEach(() => {
      mockDemoNavigation.isDemoMode = true;
      mockDemoNavigation.demoHref = (path: string) => `/demo${path}`;
    });

    afterEach(() => {
      mockDemoNavigation.isDemoMode = false;
      mockDemoNavigation.demoHref = (path: string) => path;
    });

    it('should prefix settings navigation with /demo', async () => {
      const user = userEvent.setup();
      render(<DashboardHeader />);

      const settingsItem = screen.getAllByText('Settings')[0]!.closest('[role="menuitem"]')!;
      await user.click(settingsItem);

      expect(mockPush).toHaveBeenCalledWith('/demo/dashboard/settings');
    });

    it('should prefix create space navigation with /demo', async () => {
      const user = userEvent.setup();
      render(<DashboardHeader />);

      const createItem = screen.getByText('Create New Space').closest('[role="menuitem"]')!;
      await user.click(createItem);

      expect(mockPush).toHaveBeenCalledWith('/demo/dashboard/spaces/new');
    });
  });
});
