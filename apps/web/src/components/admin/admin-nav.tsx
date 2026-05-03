'use client';

import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Flag,
  HeartPulse,
  ListChecks,
  Plug,
  Rocket,
  Building2,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '~/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'SRE',
    items: [
      { name: 'System Health', href: '/system-health', icon: HeartPulse },
      { name: 'Queues', href: '/queues', icon: ListChecks },
      { name: 'Providers', href: '/providers', icon: Plug },
      { name: 'Deployment', href: '/deployment', icon: Rocket },
    ],
  },
  {
    label: 'Data',
    items: [
      { name: 'Spaces', href: '/spaces', icon: Building2 },
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Feature Flags', href: '/feature-flags', icon: Flag },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
      { name: 'Billing Events', href: '/billing-events', icon: Receipt },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Compliance',
    items: [{ name: 'GDPR & Retention', href: '/compliance', icon: ShieldCheck }],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-4rem)]">
      <div className="py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="px-6 mb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {group.label}
            </p>
            <ul className="space-y-1 px-3">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'mr-3 h-5 w-5',
                          isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-400 dark:text-gray-500'
                        )}
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
