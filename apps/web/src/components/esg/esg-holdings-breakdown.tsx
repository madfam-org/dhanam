'use client';

import { Coins, Leaf, Users, Building2, Zap, Cloud } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PortfolioEsgAnalysis } from '@/hooks/useEsg';

interface EsgHoldingsBreakdownProps {
  analysis: PortfolioEsgAnalysis;
}

export function EsgHoldingsBreakdown({ analysis }: EsgHoldingsBreakdownProps) {
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-600';
    if (grade.startsWith('B')) return 'bg-blue-600';
    if (grade.startsWith('C')) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const formatWeight = (weight: number) => {
    return `${(weight * 100).toFixed(1)}%`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  // Sort holdings by weight (highest first)
  const sortedHoldings = [...analysis.holdings].sort((a, b) => b.weight - a.weight);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Holdings ESG Breakdown
        </CardTitle>
        <CardDescription>Individual ESG scores for each asset in your portfolio</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedHoldings.map((holding) => (
          <div
            key={holding.symbol}
            className="p-4 border rounded-lg hover:border-primary transition-colors space-y-3"
          >
            {/* Header with symbol and grade */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="font-bold text-sm">{holding.symbol}</span>
                </div>
                <div>
                  <div className="font-semibold">{holding.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatWeight(holding.weight)} of portfolio
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getGradeColor(holding.esgScore.grade)} text-white`}>
                  {holding.esgScore.grade}
                </Badge>
                <div className="text-2xl font-bold">{holding.esgScore.overallScore}</div>
              </div>
            </div>

            {/* E/S/G Mini Bars */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <Leaf className="h-3 w-3 text-green-600" />
                  <span className="font-medium">E: {holding.esgScore.environmentalScore}</span>
                </div>
                <Progress
                  value={holding.esgScore.environmentalScore}
                  className="h-1"
                  indicatorClassName="bg-green-600"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <Users className="h-3 w-3 text-blue-600" />
                  <span className="font-medium">S: {holding.esgScore.socialScore}</span>
                </div>
                <Progress
                  value={holding.esgScore.socialScore}
                  className="h-1"
                  indicatorClassName="bg-blue-600"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <Building2 className="h-3 w-3 text-purple-600" />
                  <span className="font-medium">G: {holding.esgScore.governanceScore}</span>
                </div>
                <Progress
                  value={holding.esgScore.governanceScore}
                  className="h-1"
                  indicatorClassName="bg-purple-600"
                />
              </div>
            </div>

            {/* Environmental Metrics */}
            {(holding.esgScore.energyIntensity || holding.esgScore.carbonFootprint) && (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {holding.esgScore.energyIntensity && (
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    <span>{formatNumber(holding.esgScore.energyIntensity)} kWh/tx</span>
                  </div>
                )}
                {holding.esgScore.carbonFootprint && (
                  <div className="flex items-center gap-1">
                    <Cloud className="h-3 w-3" />
                    <span>{formatNumber(holding.esgScore.carbonFootprint)} kg CO₂/tx</span>
                  </div>
                )}
              </div>
            )}

            {/* Consensus Mechanism */}
            {holding.esgScore.consensusMechanism && (
              <div className="text-xs">
                <span className="font-medium">Consensus:</span>{' '}
                <span className="text-muted-foreground">{holding.esgScore.consensusMechanism}</span>
              </div>
            )}

            {/* Description */}
            {holding.esgScore.description && (
              <p className="text-xs text-muted-foreground italic">{holding.esgScore.description}</p>
            )}
          </div>
        ))}

        {sortedHoldings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No holdings to display</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
