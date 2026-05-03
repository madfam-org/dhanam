'use client';

import { Leaf, Users, Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PortfolioEsgAnalysis } from '@/hooks/useEsg';

interface EsgPortfolioSummaryProps {
  analysis: PortfolioEsgAnalysis;
}

export function EsgPortfolioSummary({ analysis }: EsgPortfolioSummaryProps) {
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'bg-green-600';
    if (grade.startsWith('B')) return 'bg-blue-600';
    if (grade.startsWith('C')) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 55) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number) => {
    if (score >= 85) return 'bg-green-600';
    if (score >= 70) return 'bg-blue-600';
    if (score >= 55) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getTrendIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (score >= 60) return <Minus className="h-4 w-4 text-yellow-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-600" />
              Portfolio ESG Score
            </CardTitle>
            <CardDescription>
              Environmental, Social, and Governance analysis powered by Dhanam Framework v2.0
            </CardDescription>
          </div>
          <Badge className={`${getGradeColor(analysis.grade)} text-white text-lg px-4 py-2`}>
            {analysis.grade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="text-center space-y-2">
          <div className={`text-6xl font-bold ${getScoreColor(analysis.overallScore)}`}>
            {analysis.overallScore}
          </div>
          <div className="text-sm text-muted-foreground">Overall ESG Score (0-100)</div>
          <Progress
            value={analysis.overallScore}
            className="h-3"
            indicatorClassName={getProgressColor(analysis.overallScore)}
          />
        </div>

        {/* E/S/G Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Environmental */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600" />
                <span className="font-semibold">Environmental</span>
              </div>
              {getTrendIcon(analysis.breakdown.environmental)}
            </div>
            <div
              className={`text-3xl font-bold ${getScoreColor(analysis.breakdown.environmental)}`}
            >
              {analysis.breakdown.environmental}
            </div>
            <Progress
              value={analysis.breakdown.environmental}
              className="h-2"
              indicatorClassName={getProgressColor(analysis.breakdown.environmental)}
            />
            <p className="text-xs text-muted-foreground">
              Energy efficiency, carbon footprint, consensus mechanism sustainability
            </p>
          </div>

          {/* Social */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-semibold">Social</span>
              </div>
              {getTrendIcon(analysis.breakdown.social)}
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(analysis.breakdown.social)}`}>
              {analysis.breakdown.social}
            </div>
            <Progress
              value={analysis.breakdown.social}
              className="h-2"
              indicatorClassName={getProgressColor(analysis.breakdown.social)}
            />
            <p className="text-xs text-muted-foreground">
              Financial inclusion, accessibility, community development
            </p>
          </div>

          {/* Governance */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span className="font-semibold">Governance</span>
              </div>
              {getTrendIcon(analysis.breakdown.governance)}
            </div>
            <div className={`text-3xl font-bold ${getScoreColor(analysis.breakdown.governance)}`}>
              {analysis.breakdown.governance}
            </div>
            <Progress
              value={analysis.breakdown.governance}
              className="h-2"
              indicatorClassName={getProgressColor(analysis.breakdown.governance)}
            />
            <p className="text-xs text-muted-foreground">
              Decentralization, transparency, decision-making processes
            </p>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
          <span>Analysis Date: {new Date(analysis.analysisDate).toLocaleString()}</span>
          <span>Methodology: {analysis.methodology}</span>
        </div>
      </CardContent>
    </Card>
  );
}
