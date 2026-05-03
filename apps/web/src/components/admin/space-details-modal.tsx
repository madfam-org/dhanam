'use client';

import { Dialog, Badge, Card, Separator } from '@dhanam/ui';
import { Building2, Users, CreditCard, Receipt } from 'lucide-react';

import type { SpaceInfo } from '~/lib/api/admin';

interface SpaceDetailsModalProps {
  space: SpaceInfo;
  onClose: () => void;
}

export function SpaceDetailsModal({ space, onClose }: SpaceDetailsModalProps) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Space Details</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
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
              {/* Space Info */}
              <div className="flex items-start space-x-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {space.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant={space.type === 'personal' ? 'default' : 'secondary'}>
                      {space.type}
                    </Badge>
                    <Badge variant="outline">{space.currency}</Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Created:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {new Date(space.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Space ID:</span>
                  <span className="ml-2 text-gray-900 dark:text-white font-mono text-xs">
                    {space.id}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Members */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  Members ({space.members.length})
                </h4>
                <div className="space-y-2">
                  {space.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {member.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                      </div>
                      <Badge variant="outline">{member.role}</Badge>
                    </div>
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
                        {space.accountCount}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Accounts</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <Receipt className="h-8 w-8 text-gray-400" />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {space.budgetCount}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Budgets</p>
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
