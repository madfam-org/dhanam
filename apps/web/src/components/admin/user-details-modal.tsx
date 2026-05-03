'use client';

import { useTranslation } from '@dhanam/shared';
import { Dialog, Badge, Card, Separator } from '@dhanam/ui';
import { User, Mail, Shield, Globe, Clock, Building2, CreditCard, Receipt } from 'lucide-react';

import type { UserDetails } from '~/lib/api/admin';

interface UserDetailsModalProps {
  user: UserDetails;
  onClose: () => void;
}

export function UserDetailsModal({ user, onClose }: UserDetailsModalProps) {
  const { t } = useTranslation('common');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label={t('aria.closeModal')}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">User Details</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">{t('close')}</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info */}
              <div className="flex items-start space-x-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">{user.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    {user.emailVerified && (
                      <Badge variant="default" className="flex items-center space-x-1">
                        <Mail className="h-3 w-3" />
                        <span>Email Verified</span>
                      </Badge>
                    )}
                    {user.totpEnabled && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <Shield className="h-3 w-3" />
                        <span>2FA Enabled</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-sm">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 dark:text-gray-400">Locale:</span>
                    <span className="text-gray-900 dark:text-white">{user.locale}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500 dark:text-gray-400">Timezone:</span>
                    <span className="text-gray-900 dark:text-white">{user.timezone}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Created:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Last Activity:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {user.lastActivity
                        ? new Date(user.lastActivity).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Spaces */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Building2 className="h-4 w-4 mr-2" />
                  Spaces ({user.spaces.length})
                </h4>
                <div className="space-y-2">
                  {user.spaces.map((space) => (
                    <Card key={space.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {space.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Created {new Date(space.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={space.type === 'personal' ? 'default' : 'secondary'}>
                            {space.type}
                          </Badge>
                          <Badge variant="outline">{space.role}</Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-8 w-8 text-gray-400" />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {user.accountsCount}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Connected Accounts</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <Receipt className="h-8 w-8 text-gray-400" />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {user.transactionsCount}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
