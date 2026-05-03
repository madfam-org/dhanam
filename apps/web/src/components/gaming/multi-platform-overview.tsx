'use client';

import { Layers, Coins, LandPlot, Image as ImageIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PlatformSummary {
  platform: string;
  label: string;
  chain: string;
  totalValueUsd: number;
  tokensCount: number;
  stakingValueUsd: number;
  stakingApy?: number;
  landCount: number;
  nftCount: number;
  monthlyEarningsUsd: number;
}

interface MultiPlatformOverviewProps {
  platforms: PlatformSummary[];
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const CHAIN_COLORS: Record<string, string> = {
  ethereum: 'bg-blue-500/10 text-blue-600',
  polygon: 'bg-purple-500/10 text-purple-600',
  ronin: 'bg-sky-500/10 text-sky-600',
  solana: 'bg-green-500/10 text-green-600',
  galachain: 'bg-orange-500/10 text-orange-600',
  'immutable-zkevm': 'bg-emerald-500/10 text-emerald-600',
};

export function MultiPlatformOverview({ platforms }: MultiPlatformOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-5 w-5" />
          Multi-Platform Positions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {platforms.map((p) => (
            <div key={p.platform} className="p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.label}</span>
                  <Badge variant="outline" className={CHAIN_COLORS[p.chain] || ''}>
                    {p.chain}
                  </Badge>
                </div>
                <span className="font-semibold">{formatUsd(p.totalValueUsd)}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  {p.stakingValueUsd > 0 ? `${formatUsd(p.stakingValueUsd)} staked` : 'No staking'}
                  {p.stakingApy ? ` (${p.stakingApy}%)` : ''}
                </div>
                <div className="flex items-center gap-1">
                  <LandPlot className="h-3 w-3" />
                  {p.landCount} land
                </div>
                <div className="flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  {p.nftCount} NFTs
                </div>
                <div className="text-green-600 font-medium">
                  +{formatUsd(p.monthlyEarningsUsd)}/mo
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
