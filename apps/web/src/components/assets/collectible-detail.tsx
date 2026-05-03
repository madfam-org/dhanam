'use client';

import {
  Package,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { collectiblesApi, type CollectibleValuation } from '@/lib/api/collectibles';

import { CollectibleLinkModal } from './collectible-link-modal';

interface CollectibleMetadata {
  collectible?: {
    category?: string;
    provider?: string;
    externalId?: string;
    valuationEnabled?: boolean;
    lastProviderSync?: string;
  };
  [key: string]: unknown;
}

interface CollectibleDetailProps {
  assetId: string;
  spaceId: string;
  name: string;
  currentValue: number;
  currency: string;
  metadata?: CollectibleMetadata;
  onUpdate?: () => void;
}

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CollectibleDetail({
  assetId,
  spaceId,
  name,
  currentValue,
  currency,
  metadata,
  onUpdate,
}: CollectibleDetailProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [valuation, setValuation] = useState<CollectibleValuation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const collectibleMeta = metadata?.collectible;
  const isLinked = collectibleMeta?.valuationEnabled && collectibleMeta?.provider;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await collectiblesApi.refresh(spaceId, assetId);
      setValuation(result);
      setSuccess('Valuation refreshed successfully');
      onUpdate?.();
    } catch {
      setError('Failed to refresh valuation');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    setError(null);
    setSuccess(null);
    try {
      await collectiblesApi.unlink(spaceId, assetId);
      setSuccess('Collectible unlinked from provider');
      setValuation(null);
      onUpdate?.();
    } catch {
      setError('Failed to unlink collectible');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleLinked = () => {
    setSuccess('Collectible linked to provider');
    onUpdate?.();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {name}
              </CardTitle>
              <CardDescription className="mt-1">
                {collectibleMeta?.category || 'Collectible'} ·{' '}
                {collectibleMeta?.provider || 'No provider'}
              </CardDescription>
            </div>
            <Badge variant={isLinked ? 'default' : 'secondary'}>
              {isLinked ? `${collectibleMeta?.provider} Linked` : 'Manual Valuation'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Current Value */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Value</p>
              <p className="text-2xl font-bold">{formatCurrency(currentValue, currency)}</p>
              {isLinked && (
                <p className="text-xs text-muted-foreground">Source: {collectibleMeta?.provider}</p>
              )}
            </div>

            {valuation?.marketValueLow != null && valuation?.marketValueHigh != null && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Valuation Range</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(valuation.marketValueLow, currency)} —{' '}
                  {formatCurrency(valuation.marketValueHigh, currency)}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <Separator />
          <div className="flex flex-wrap gap-3">
            {isLinked ? (
              <>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Valuation
                </Button>
                <Button variant="ghost" size="sm" onClick={handleUnlink} disabled={isUnlinking}>
                  {isUnlinking ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Unlink
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowLinkModal(true)}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Link to Provider
              </Button>
            )}
          </div>

          {/* Last Sync */}
          {collectibleMeta?.lastProviderSync && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Last synced: {formatDate(collectibleMeta.lastProviderSync)}
            </div>
          )}
        </CardContent>
      </Card>

      <CollectibleLinkModal
        open={showLinkModal}
        onOpenChange={setShowLinkModal}
        spaceId={spaceId}
        assetId={assetId}
        onLinked={handleLinked}
      />
    </>
  );
}
