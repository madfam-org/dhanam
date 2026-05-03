'use client';

import { Image as ImageIcon, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NftItem {
  name: string;
  collection: string;
  currentValue: number;
  acquisitionCost: number;
  imageUrl?: string;
  platform?: string;
  chain?: string;
}

interface NftGalleryProps {
  items: NftItem[];
  totalValueUsd: number;
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export function NftGallery({ items, totalValueUsd }: NftGalleryProps) {
  const totalCost = items.reduce((sum, item) => sum + item.acquisitionCost, 0);
  const totalPnl = totalValueUsd - totalCost;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-5 w-5" />
            NFT Gallery
          </CardTitle>
          <div className="text-right">
            <p className="text-sm font-semibold">{formatUsd(totalValueUsd)}</p>
            <p className={`text-xs ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnl >= 0 ? '+' : ''}
              {formatUsd(totalPnl)} P&L
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item, idx) => {
            const pnl = item.currentValue - item.acquisitionCost;
            const pnlPercent = ((pnl / item.acquisitionCost) * 100).toFixed(1);
            const isPositive = pnl >= 0;

            return (
              <div key={idx} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {item.collection}
                      </Badge>
                      {item.platform && (
                        <Badge variant="secondary" className="text-xs">
                          {item.platform}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{formatUsd(item.currentValue)}</p>
                  <div
                    className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {pnlPercent}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
