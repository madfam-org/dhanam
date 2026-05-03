'use client';

import { MapPin, Home } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LandParcel {
  coordinates?: string;
  size?: string;
  acquiredDate?: string;
  rentalStatus?: 'rented' | 'vacant' | 'self-use';
  monthlyRental?: number;
  platform?: string;
  tier?: string;
}

interface LandPortfolioProps {
  parcels: LandParcel[];
  floorPriceUsd: number;
  totalValueUsd: number;
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export function LandPortfolio({ parcels, floorPriceUsd, totalValueUsd }: LandPortfolioProps) {
  const rentedCount = parcels.filter((p) => p.rentalStatus === 'rented').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-5 w-5" />
            LAND Portfolio
          </CardTitle>
          <Badge variant="outline">{parcels.length} parcels</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-lg font-semibold">{formatUsd(totalValueUsd)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">Floor Price</p>
            <p className="text-lg font-semibold">{formatUsd(floorPriceUsd)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">Rented</p>
            <p className="text-lg font-semibold">
              {rentedCount}/{parcels.length}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {parcels.map((parcel, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {parcel.coordinates || parcel.tier || 'Land'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {parcel.size ? `${parcel.size} plot` : ''}
                    {parcel.platform ? ` · ${parcel.platform}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {parcel.rentalStatus === 'rented' ? (
                  <Badge variant="default" className="text-xs">
                    Rented
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Vacant
                  </Badge>
                )}
                {parcel.monthlyRental && (
                  <p className="text-xs text-green-600 mt-1">{parcel.monthlyRental} SAND/mo</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
