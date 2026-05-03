'use client';

import { Button } from '@dhanam/ui';
import { Shield, LogOut, Home } from 'lucide-react';

import { useAuth } from '~/lib/hooks/use-auth';

export function AdminHeader() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    // Redirect to app subdomain login after logout for cross-subdomain consistency
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.dhan.am';
    window.location.href = `${appUrl}/login`;
  };

  const handleBackToDashboard = () => {
    // Navigate to app subdomain dashboard for cross-subdomain navigation
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.dhan.am';
    window.location.href = `${appUrl}/dashboard`;
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToDashboard}
              className="flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>Back to App</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
