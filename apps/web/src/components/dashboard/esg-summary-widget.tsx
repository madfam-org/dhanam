'use client';

import { Leaf, Users, Building2, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEsg } from '@/hooks/useEsg';

export function EsgSummaryWidget() {
  const { getPortfolioAnalysis, loading } = useEsg();
  const [analysis, setAnalysis] = useState<{
    grade: string;
    overallScore: number;
    breakdown: { environmental: number; social: number; governance: number };
  } | null>(null);

  useEffect(() => {
    const loadAnalysis = async () => {
      const data = await getPortfolioAnalysis();
      if (data) setAnalysis(data);
    };
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: Only run on mount; getPortfolioAnalysis is stable from useEsg hook
  }, []);

  const getGradeColor = (grade: string) => {
    if (grade?.startsWith('A')) return 'bg-green-600';
    if (grade?.startsWith('B')) return 'bg-blue-600';
    if (grade?.startsWith('C')) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  if (loading && !analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" />
            ESG Score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-600" />
            ESG Score
          </CardTitle>
          <CardDescription>Environmental, Social, and Governance rating</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Leaf className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">No crypto holdings found</p>
            <Link href="/esg">
              <Button variant="outline" size="sm">
                Learn More
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-600" />
              ESG Score
            </CardTitle>
            <CardDescription>Portfolio sustainability rating</CardDescription>
          </div>
          <Badge className={`${getGradeColor(analysis.grade)} text-white`}>{analysis.grade}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="text-center">
          <div className="text-4xl font-bold text-green-600">{analysis.overallScore}</div>
          <p className="text-xs text-muted-foreground">Overall Score</p>
        </div>

        {/* E/S/G Mini Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Leaf className="h-3 w-3 text-green-600" />
              <span>Environmental</span>
            </div>
            <span className="font-semibold">{analysis.breakdown.environmental}</span>
          </div>
          <Progress
            value={analysis.breakdown.environmental}
            className="h-1"
            indicatorClassName="bg-green-600"
          />

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3 text-blue-600" />
              <span>Social</span>
            </div>
            <span className="font-semibold">{analysis.breakdown.social}</span>
          </div>
          <Progress
            value={analysis.breakdown.social}
            className="h-1"
            indicatorClassName="bg-blue-600"
          />

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3 text-purple-600" />
              <span>Governance</span>
            </div>
            <span className="font-semibold">{analysis.breakdown.governance}</span>
          </div>
          <Progress
            value={analysis.breakdown.governance}
            className="h-1"
            indicatorClassName="bg-purple-600"
          />
        </div>

        {/* View Details Link */}
        <Link href="/esg">
          <Button variant="outline" size="sm" className="w-full">
            View Full Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
