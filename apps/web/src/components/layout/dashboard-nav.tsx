'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@dhanam/ui';
import { useTranslation } from '@dhanam/shared';

import { useDemoNavigation } from '~/lib/contexts/demo-navigation-context';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  TrendingUp,
  PiggyBank,
  Settings,
  FileText,
  Leaf,
  Target,
  AlertTriangle,
  Users,
  ScrollText,
  Landmark,
  Gamepad2,
  CreditCard,
} from 'lucide-react';

const navigation = [
  { key: 'dashboard' as const, href: '/dashboard', icon: LayoutDashboard },
  { key: 'accounts' as const, href: '/accounts', icon: Wallet },
  { key: 'transactions' as const, href: '/transactions', icon: Receipt },
  { key: 'budgets' as const, href: '/budgets', icon: PiggyBank },
  { key: 'zeroBased' as const, href: '/budgets/zero-based', icon: Landmark },
  { key: 'goals' as const, href: '/goals', icon: Target },
  { key: 'households' as const, href: '/households', icon: Users },
  { key: 'estatePlanning' as const, href: '/estate-planning', icon: ScrollText },
  { key: 'analytics' as const, href: '/analytics', icon: TrendingUp },
  { key: 'esgInsights' as const, href: '/esg', icon: Leaf },
  { key: 'gaming' as const, href: '/gaming', icon: Gamepad2 },
  { key: 'retirement' as const, href: '/retirement', icon: Target },
  { key: 'scenarios' as const, href: '/scenarios', icon: AlertTriangle },
  { key: 'reports' as const, href: '/reports', icon: FileText },
  { key: 'billing' as const, href: '/billing', icon: CreditCard },
  { key: 'settings' as const, href: '/settings', icon: Settings },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { t } = useTranslation('dashboard');
  const { demoHref, stripDemoPrefix } = useDemoNavigation();

  const normalizedPath = stripDemoPrefix(pathname);

  return (
    <nav className="w-64 border-r bg-background">
      <div className="flex h-full flex-col gap-y-5 overflow-y-auto px-6 pb-4">
        <ul className="flex flex-1 flex-col gap-y-7 pt-6">
          <li>
            <ul className="-mx-2 space-y-1">
              {navigation.map((item) => {
                const isActive =
                  normalizedPath === item.href || normalizedPath.startsWith(item.href + '/');
                return (
                  <li key={item.key} data-tour={`sidebar-${item.key}`}>
                    <Link
                      href={demoHref(item.href)}
                      className={cn(
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        'group flex gap-x-3 rounded-md p-2 text-sm font-medium leading-6 transition-colors'
                      )}
                    >
                      <item.icon
                        className={cn(
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground group-hover:text-foreground',
                          'h-5 w-5 shrink-0'
                        )}
                        aria-hidden="true"
                      />
                      {t(`sidebar.${item.key}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  );
}
