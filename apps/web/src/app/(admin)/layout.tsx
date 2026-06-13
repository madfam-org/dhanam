'use client';

import { useEffect } from 'react';

import { AdminHeader } from '~/components/admin/admin-header';
import { AdminNav } from '~/components/admin/admin-nav';
import { AdminProvider } from '~/contexts/AdminContext';
import { usePublicAdminUrl, usePublicAppUrl } from '~/hooks/usePublicSurface';
import { useAuth } from '~/lib/hooks/use-auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const appUrl = usePublicAppUrl();
  const adminUrl = usePublicAdminUrl();

  useEffect(() => {
    // In production, redirect to standalone admin app at admin.dhan.am
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'production' &&
      window.location.hostname !== 'admin.dhan.am'
    ) {
      const adminUrlResolved = adminUrl;
      const path = window.location.pathname.replace(/^\/(admin)/, '');
      window.location.href = `${adminUrlResolved}${path || '/dashboard'}`;
      return;
    }

    if (!isAuthenticated) {
      // Redirect to app subdomain login with return URL for cross-subdomain auth
      const returnUrl =
        typeof window !== 'undefined' ? encodeURIComponent(window.location.href) : '';
      window.location.href = `${appUrl}/login?from=${returnUrl}`;
      return;
    }

    // Check if user has admin access
    // For now, we'll check if the user has admin or owner role in any space
    // In production, you might want to have a dedicated admin flag
    const hasAdminAccess = user?.spaces?.some(
      (space) => space.role === 'admin' || space.role === 'owner'
    );

    if (!hasAdminAccess) {
      // Redirect non-admins to app subdomain dashboard
      window.location.href = `${appUrl}/dashboard`;
    }
  }, [adminUrl, appUrl, isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const hasAdminAccess = user.spaces?.some(
    (space) => space.role === 'admin' || space.role === 'owner'
  );

  if (!hasAdminAccess) {
    return null;
  }

  return (
    <AdminProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AdminHeader />
        <div className="flex">
          <AdminNav />
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}
