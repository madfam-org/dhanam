'use client';

import { Lightbulb, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Info } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortfolioEsgAnalysis, EsgTrends } from '@/hooks/useEsg';

interface EsgInsightsProps {
  analysis: PortfolioEsgAnalysis;
  trends?: EsgTrends | null;
}

export function EsgInsights({ analysis, trends }: EsgInsightsProps) {
  const getInsightIcon = (insight: string) => {
    if (insight.toLowerCase().includes('excellent') || insight.toLowerCase().includes('strong')) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    }
    if (insight.toLowerCase().includes('consider') || insight.toLowerCase().includes('diversif')) {
      return <Info className="h-4 w-4 text-blue-600" />;
    }
    if (insight.toLowerCase().includes('high') && insight.toLowerCase().includes('impact')) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    return <Lightbulb className="h-4 w-4 text-yellow-600" />;
  };

  const getInsightVariant = (insight: string): 'default' | 'destructive' => {
    if (insight.toLowerCase().includes('high') && insight.toLowerCase().includes('impact')) {
      return 'destructive';
    }
    return 'default';
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            Portfolio Insights
          </CardTitle>
          <CardDescription>Personalized recommendations based on your holdings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {analysis.insights && analysis.insights.length > 0 ? (
            analysis.insights.map((insight, index) => (
              <Alert key={index} variant={getInsightVariant(insight)}>
                {getInsightIcon(insight)}
                <AlertDescription className="ml-2">{insight}</AlertDescription>
              </Alert>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No insights available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Market Trends */}
      {trends && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              ESG Market Trends
            </CardTitle>
            <CardDescription>Current trends in cryptocurrency ESG performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Improving Assets */}
            {trends.trending.improving && trends.trending.improving.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span>Improving ESG Performance</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trends.trending.improving.map((symbol) => (
                    <Badge key={symbol} className="bg-green-600 text-white">
                      {symbol}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Declining Assets */}
            {trends.trending.declining && trends.trending.declining.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span>Declining ESG Performance</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trends.trending.declining.map((symbol) => (
                    <Badge key={symbol} variant="destructive">
                      {symbol}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Market Insights */}
            {trends.marketInsights && trends.marketInsights.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <div className="text-sm font-semibold">Market Insights</div>
                <div className="space-y-2">
                  {trends.marketInsights.map((insight, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-1.5" />
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {trends?.recommendations && trends.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              ESG Recommendations
            </CardTitle>
            <CardDescription>Assets with strong ESG profiles worth considering</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {trends.recommendations.map((recommendation, index) => (
              <div
                key={index}
                className="p-3 border rounded-lg hover:border-primary transition-colors"
              >
                <p className="text-sm">{recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
