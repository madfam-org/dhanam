'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@dhanam/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dhanam/ui';
import { Settings, LogOut, ChevronDown, Shield } from 'lucide-react';
import dynamic from 'next/dynamic';

const UserButton = dynamic(() => import('@janua/react-sdk').then((mod) => mod.UserButton), {
  ssr: false,
});
import { useAuth as useJanuaAuth } from '@janua/react-sdk';
import { useAuth } from '~/lib/hooks/use-auth';
import { useSpaces } from '~/lib/hooks/use-spaces';
import { useSpaceStore } from '~/stores/space';
import { useTranslation } from '@dhanam/shared';

import { useDemoNavigation } from '~/lib/contexts/demo-navigation-context';
import { PersonaSwitcher } from '~/components/demo/persona-switcher';
import { MobileSidebar } from '~/components/layout/mobile-sidebar';
import { NotificationDropdown } from '~/components/layout/notification-dropdown';
import { SearchCommand } from '~/components/search/search-command';
import { ThemeToggle } from '~/components/theme-toggle';
import { LocaleSwitcher } from '~/components/locale-switcher/LocaleSwitcher';
import type { Space } from '@dhanam/shared';

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const isDemo = user?.email?.endsWith('@dhanam.demo') ?? false;
  const currentPersona = isDemo ? user?.email?.split('@')[0] : undefined;
  const spacesQuery = useSpaces();
  const spaces = spacesQuery.data as Space[] | undefined;
  const spacesLoading = spacesQuery.isLoading;
  const isPlaceholderData = spacesQuery.isPlaceholderData;
  const { currentSpace, setCurrentSpace } = useSpaceStore();
  const router = useRouter();
  const { t } = useTranslation('dashboard');
  const { demoHref } = useDemoNavigation();

  const { signOut: januaSignOut } = useJanuaAuth();

  const handleLogout = async () => {
    // Clear demo-mode cookie on logout
    if (typeof document !== 'undefined') {
      document.cookie = 'demo-mode=; path=/; max-age=0; SameSite=Lax';
    }
    await logout();
    await januaSignOut();
    router.push('/login');
  };

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <MobileSidebar />
          <span className="text-2xl font-bold shrink-0">Dhanam</span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-0 sm:min-w-[200px] justify-between"
                disabled={spacesLoading && !spaces?.length}
              >
                {spacesLoading && !spaces?.length ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('header.loading')}
                  </span>
                ) : (
                  <>
                    <span className="truncate">
                      {currentSpace?.name || t('header.selectSpace')}
                    </span>
                    {isPlaceholderData && (
                      <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0" />
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
              <DropdownMenuLabel>{t('header.yourSpaces')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {spaces && spaces.length > 0 ? (
                <>
                  {spaces.map((space) => (
                    <DropdownMenuItem key={space.id} onClick={() => setCurrentSpace(space)}>
                      <div className="flex items-center justify-between w-full">
                        <span>{space.name}</span>
                        <span className="text-xs text-muted-foreground">{space.type}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(demoHref('/dashboard/spaces/new'))}>
                    {t('header.createNewSpace')}
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => router.push(demoHref('/dashboard/spaces/new'))}>
                  {t('header.createFirstSpace')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          {currentSpace && (
            <div className="hidden sm:block" data-tour="search-button">
              <SearchCommand spaceId={currentSpace.id} />
            </div>
          )}

          {isDemo && (
            <div className="hidden sm:block" data-tour="persona-switcher">
              <PersonaSwitcher currentPersona={currentPersona} />
            </div>
          )}

          <LocaleSwitcher />
          <ThemeToggle />

          <NotificationDropdown />

          <UserButton afterSignOutUrl="/login" showName={false} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <span className="hidden sm:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(demoHref('/dashboard/settings'))}>
                <Settings className="mr-2 h-4 w-4" />
                {t('header.settings')}
              </DropdownMenuItem>
              {/* Show admin link for users with admin/owner roles */}
              {user?.spaces?.some((space) => space.role === 'admin' || space.role === 'owner') && (
                <DropdownMenuItem
                  onClick={() => {
                    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.dhan.am';
                    window.location.href = `${adminUrl}/dashboard`;
                  }}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {t('header.adminDashboard')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                {t('header.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
