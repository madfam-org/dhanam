'use client';

import {
  Home,
  MapPin,
  Calendar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Link as LinkIcon,
  Unlink,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { realEstateApi, type PropertyValuationSummary } from '@/lib/api/real-estate';

interface RealEstateMetadata {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  sqft?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  lotSize?: number;
  zpid?: string;
  lastZillowSync?: string;
  zillowEnabled?: boolean;
}

interface PropertyDetailProps {
  assetId: string;
  spaceId: string;
  name: string;
  currentValue: number;
  currency: string;
  metadata?: RealEstateMetadata;
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

export function PropertyDetail({
  assetId,
  spaceId,
  name,
  currentValue,
  currency,
  metadata,
  onUpdate,
}: PropertyDetailProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [valuationSummary, setValuationSummary] = useState<PropertyValuationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isZillowLinked = metadata?.zillowEnabled && metadata?.zpid;
  const fullAddress = [metadata?.address, metadata?.city, metadata?.state, metadata?.zip]
    .filter(Boolean)
    .join(', ');

  const loadValuationSummary = async () => {
    try {
      const summary = await realEstateApi.getValuationSummary(spaceId, assetId);
      setValuationSummary(summary);
    } catch (err) {
      console.error('Failed to load valuation summary:', err);
    }
  };

  const handleLinkToZillow = async () => {
    setIsLinking(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await realEstateApi.linkToZillow(spaceId, assetId);
      if (result.success) {
        setSuccess('Property linked to Zillow successfully!');
        await loadValuationSummary();
        onUpdate?.();
      } else {
        setError(result.error || 'Failed to link property to Zillow');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkFromZillow = async () => {
    setIsLinking(true);
    setError(null);
    setSuccess(null);

    try {
      await realEstateApi.unlinkFromZillow(spaceId, assetId);
      setSuccess('Property unlinked from Zillow');
      setValuationSummary(null);
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLinking(false);
    }
  };

  const handleRefreshValuation = async () => {
    setIsRefreshing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await realEstateApi.refreshValuation(spaceId, assetId);
      if (result.success) {
        const change = (result.newValue || 0) - (result.previousValue || 0);
        setSuccess(
          `Valuation updated: ${formatCurrency(result.newValue || 0, currency)} (${change >= 0 ? '+' : ''}${formatCurrency(change, currency)})`
        );
        await loadValuationSummary();
        onUpdate?.();
      } else {
        setError(result.error || 'Failed to refresh valuation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              {name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3" />
              {fullAddress || 'No address specified'}
            </CardDescription>
          </div>
          <Badge variant={isZillowLinked ? 'default' : 'secondary'}>
            {isZillowLinked ? 'Zillow Linked' : 'Manual Valuation'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Alerts */}
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

        {/* Current Value Section */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Current Value</p>
            <p className="text-2xl font-bold">{formatCurrency(currentValue, currency)}</p>
            {valuationSummary?.source && (
              <p className="text-xs text-muted-foreground">
                Source: {valuationSummary.source === 'zillow' ? 'Zillow Zestimate' : 'Manual Entry'}
              </p>
            )}
          </div>

          {valuationSummary?.rentEstimate && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Rent Estimate</p>
              <p className="text-xl font-semibold">
                {formatCurrency(valuationSummary.rentEstimate, currency)}/mo
              </p>
              <p className="text-xs text-muted-foreground">Based on Zillow Rent Zestimate</p>
            </div>
          )}
        </div>

        {/* Zestimate Range */}
        {valuationSummary?.zestimate && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Zestimate Range</p>
                {valuationSummary.valueChange30Day !== undefined && (
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      valuationSummary.valueChange30Day >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {valuationSummary.valueChange30Day >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {formatCurrency(Math.abs(valuationSummary.valueChange30Day), currency)} (30d)
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {formatCurrency(valuationSummary.zestimateLow || 0, currency)}
                </span>
                <span className="font-semibold">
                  {formatCurrency(valuationSummary.zestimate, currency)}
                </span>
                <span className="text-muted-foreground">
                  {formatCurrency(valuationSummary.zestimateHigh || 0, currency)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${
                      ((valuationSummary.zestimate - (valuationSummary.zestimateLow || 0)) /
                        ((valuationSummary.zestimateHigh || valuationSummary.zestimate) -
                          (valuationSummary.zestimateLow || 0))) *
                      100
                    }%`,
                    marginLeft: '0%',
                  }}
                />
              </div>
            </div>
          </>
        )}

        {/* Property Details */}
        <Separator />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {metadata?.propertyType && (
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">{metadata.propertyType}</p>
            </div>
          )}
          {metadata?.sqft && (
            <div>
              <p className="text-muted-foreground">Size</p>
              <p className="font-medium">{metadata.sqft.toLocaleString()} sq ft</p>
            </div>
          )}
          {metadata?.bedrooms && (
            <div>
              <p className="text-muted-foreground">Bedrooms</p>
              <p className="font-medium">{metadata.bedrooms}</p>
            </div>
          )}
          {metadata?.bathrooms && (
            <div>
              <p className="text-muted-foreground">Bathrooms</p>
              <p className="font-medium">{metadata.bathrooms}</p>
            </div>
          )}
          {metadata?.yearBuilt && (
            <div>
              <p className="text-muted-foreground">Year Built</p>
              <p className="font-medium">{metadata.yearBuilt}</p>
            </div>
          )}
          {metadata?.lotSize && (
            <div>
              <p className="text-muted-foreground">Lot Size</p>
              <p className="font-medium">{metadata.lotSize.toLocaleString()} sq ft</p>
            </div>
          )}
        </div>

        {/* Zillow Actions */}
        <Separator />
        <div className="flex flex-wrap gap-3">
          {isZillowLinked ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshValuation}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh Valuation
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnlinkFromZillow}
                disabled={isLinking}
              >
                {isLinking ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Unlink from Zillow
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLinkToZillow} disabled={isLinking}>
              {isLinking ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4 mr-2" />
              )}
              Link to Zillow
            </Button>
          )}
        </div>

        {/* Last Sync Info */}
        {metadata?.lastZillowSync && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Last synced: {formatDate(metadata.lastZillowSync)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
