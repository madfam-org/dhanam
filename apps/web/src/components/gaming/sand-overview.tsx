'use client';

import { Lock, TrendingUp, Coins } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SandOverviewProps {
  sandStaked: number;
  stakingApy: number;
  monthlyReward: number;
  sandPrice?: number;
}

const formatUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

export function SandOverview({
  sandStaked,
  stakingApy,
  monthlyReward,
  sandPrice = 0.45,
}: SandOverviewProps) {
  const stakedValueUsd = sandStaked * sandPrice;
  const liquidSand = 2000; // Placeholder — would come from API
  const totalSand = sandStaked + liquidSand;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coins className="h-5 w-5" />
          SAND Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <Lock className="h-3 w-3" />
              Staked
            </div>
            <p className="text-lg font-semibold">{formatNumber(sandStaked)} SAND</p>
            <p className="text-xs text-muted-foreground">{formatUsd(stakedValueUsd)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Liquid</p>
            <p className="text-lg font-semibold">{formatNumber(liquidSand)} SAND</p>
            <p className="text-xs text-muted-foreground">{formatUsd(liquidSand * sandPrice)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              APY
            </div>
            <p className="text-lg font-semibold text-green-600">{stakingApy}%</p>
            <Badge variant="secondary" className="text-xs mt-1">
              Active
            </Badge>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-1">Monthly Reward</p>
            <p className="text-lg font-semibold">{formatNumber(monthlyReward)} SAND</p>
            <p className="text-xs text-muted-foreground">
              {formatUsd(monthlyReward * sandPrice)}/mo
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t text-sm text-muted-foreground">
          Total: {formatNumber(totalSand)} SAND ({formatUsd(totalSand * sandPrice)})
        </div>
      </CardContent>
    </Card>
  );
}
