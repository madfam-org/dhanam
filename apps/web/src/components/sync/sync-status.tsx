'use client';

import { useTranslation } from '@dhanam/shared';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@dhanam/ui';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, CheckCircle, XCircle, Clock, Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface SyncStatusProps {
  spaceId: string;
}

interface SyncStatus {
  overall: 'healthy' | 'syncing' | 'error' | 'offline';
  lastSync: string;
  accounts: Array<{
    id: string;
    name: string;
    provider: string;
    status: 'connected' | 'syncing' | 'error' | 'expired';
    lastSync: string;
    error?: string;
  }>;
  nextSync: string;
}

export function SyncStatus({ spaceId }: SyncStatusProps) {
  const { t } = useTranslation('apiErrors');

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['sync-status', spaceId],
    queryFn: () => {
      // Mock data - replace with actual API call
      return Promise.resolve({
        overall: 'healthy',
        lastSync: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
        nextSync: new Date(Date.now() + 1000 * 60 * 45).toISOString(), // 45 minutes from now
        accounts: [
          {
            id: '1',
            name: 'BBVA Checking',
            provider: 'belvo',
            status: 'connected',
            lastSync: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          },
          {
            id: '2',
            name: 'Santander Credit',
            provider: 'belvo',
            status: 'syncing',
            lastSync: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          },
          {
            id: '3',
            name: 'Chase Sapphire',
            provider: 'plaid',
            status: 'error',
            lastSync: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            error: 'Account credentials expired',
          },
          {
            id: '4',
            name: 'Bitso Wallet',
            provider: 'bitso',
            status: 'connected',
            lastSync: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          },
        ],
      } as SyncStatus);
    },
    enabled: !!spaceId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'syncing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'error':
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
            {t('SYNC_STATUS_CONNECTED')}
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="secondary" className="text-blue-700 bg-blue-50 border-blue-200">
            {t('SYNC_STATUS_SYNCING')}
          </Badge>
        );
      case 'error':
      case 'expired':
        return <Badge variant="destructive">{t('SYNC_STATUS_ERROR')}</Badge>;
      default:
        return <Badge variant="outline">{t('SYNC_STATUS_UNKNOWN')}</Badge>;
    }
  };

  const getOverallStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Wifi className="h-5 w-5 text-green-600" />;
      case 'syncing':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'offline':
        return <WifiOff className="h-5 w-5 text-gray-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  if (isLoading || !syncStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {getOverallStatusIcon(syncStatus.overall)}
            {t('SYNC_STATUS_TITLE')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm">
                {t('SYNC_STATUS_LAST_UPDATED', {
                  time: formatDistanceToNow(new Date(syncStatus.lastSync), { addSuffix: true }),
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('SYNC_STATUS_NEXT_SYNC', {
                  time: formatDistanceToNow(new Date(syncStatus.nextSync), { addSuffix: true }),
                })}
              </p>
            </div>
            <Button size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('SYNC_STATUS_SYNC_NOW')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('SYNC_STATUS_ACCOUNT_CONNECTIONS')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {syncStatus.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(account.status)}
                  <div>
                    <p className="font-medium text-sm">{account.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.provider} •{' '}
                      {t('SYNC_STATUS_LAST_SYNC', {
                        time: formatDistanceToNow(new Date(account.lastSync), { addSuffix: true }),
                      })}
                    </p>
                    {account.error && <p className="text-xs text-red-600 mt-1">{account.error}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(account.status)}
                  {account.status === 'error' && (
                    <Button size="sm" variant="outline">
                      {t('SYNC_STATUS_RECONNECT')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {syncStatus.accounts.filter((acc) => acc.status === 'connected').length}
                </p>
                <p className="text-xs text-muted-foreground">{t('SYNC_STATUS_CONNECTED_COUNT')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-2xl font-bold">
                  {
                    syncStatus.accounts.filter(
                      (acc) => acc.status === 'error' || acc.status === 'expired'
                    ).length
                  }
                </p>
                <p className="text-xs text-muted-foreground">{t('SYNC_STATUS_NEED_ATTENTION')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {syncStatus.accounts.filter((acc) => acc.status === 'syncing').length}
                </p>
                <p className="text-xs text-muted-foreground">{t('SYNC_STATUS_SYNCING_COUNT')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
