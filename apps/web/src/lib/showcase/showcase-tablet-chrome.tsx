'use client';

import { getShowcaseNavForPersona, useTranslation, type ShowcasePersona } from '@dhanam/shared';
import { cn } from '@dhanam/ui';
import {
  AlertTriangle,
  LayoutDashboard,
  PiggyBank,
  Receipt,
  ScrollText,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useAuth } from '~/lib/hooks/use-auth';

const NAV_ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  transactions: Receipt,
  budgets: PiggyBank,
  analytics: TrendingUp,
  goals: Target,
  assets: Wallet,
  projections: TrendingUp,
  scenarios: AlertTriangle,
  estatePlanning: ScrollText,
};

function normalizePersona(value: string | null): ShowcasePersona {
  return value === 'patricia' ? 'patricia' : 'maria';
}

function normalizePath(pathname: string): string {
  const stripped = pathname.replace(/^\/embed\/demo/, '');
  return stripped || '/dashboard';
}

/**
 * Compact tablet shell for hero iframe showcase — header + bottom nav rail.
 * Tour driver navigates routes; active tab reflects current pathname.
 */
export function ShowcaseTabletChrome() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { t } = useTranslation('dashboard');
  const persona = normalizePersona(searchParams.get('persona'));
  const navItems = getShowcaseNavForPersona(persona);
  const currentPath = normalizePath(pathname);
  const displayName = user?.name?.split(' ')[0] ?? (persona === 'patricia' ? 'Patricia' : 'María');

  return (
    <div
      className="showcase-tablet-chrome shrink-0 border-b border-border/60 bg-card/95 backdrop-blur-sm"
      data-showcase-chrome
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary"
            aria-hidden
          >
            D
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold tracking-tight">Dhanam</p>
            <p className="truncate text-[10px] text-muted-foreground">{displayName}</p>
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          Demo
        </span>
      </div>

      <nav
        aria-label={t('sidebar.dashboard')}
        className="flex items-stretch justify-between gap-0.5 border-t border-border/50 px-1 py-1"
        data-showcase-nav
      >
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.key] ?? LayoutDashboard;
          const isActive = currentPath === item.path || currentPath.startsWith(`${item.path}/`);
          const label = t(`sidebar.${item.key}`);

          return (
            <div
              key={item.key}
              className={cn(
                'flex flex-1 flex-col items-center justify-center rounded-md px-0.5 py-1 transition-colors',
                isActive
                  ? 'bg-primary/12 text-primary showcase-nav-active'
                  : 'text-muted-foreground'
              )}
              data-showcase-nav-item={item.key}
              data-active={isActive ? 'true' : 'false'}
              title={label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="mt-0.5 max-w-full truncate text-[9px] font-medium leading-none">
                {label}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
