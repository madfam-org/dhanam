'use client';

import { useTranslation } from '@dhanam/shared';
import { Leaf, RefreshCw, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { EsgHoldingsBreakdown } from '@/components/esg/esg-holdings-breakdown';
import { EsgInsights } from '@/components/esg/esg-insights';
import { EsgPortfolioSummary } from '@/components/esg/esg-portfolio-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useEsg } from '@/hooks/useEsg';
import type { PortfolioEsgAnalysis, EsgTrends } from '@/hooks/useEsg';

export default function EsgPage() {
  const { t } = useTranslation('esg');
  const { t: tCommon } = useTranslation('common');
  const { getPortfolioAnalysis, getTrends, loading } = useEsg();
  const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioEsgAnalysis | null>(null);
  const [trends, setTrends] = useState<EsgTrends | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const loadData = async () => {
    setRefreshing(true);
    setHasError(false);
    try {
      const [analysisData, trendsData] = await Promise.all([getPortfolioAnalysis(), getTrends()]);
      if (analysisData) setPortfolioAnalysis(analysisData);
      if (trendsData) setTrends(trendsData);
    } catch {
      setHasError(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: Only load on mount; loadData references hook functions that are stable
  }, []);

  const handleRefresh = () => {
    loadData();
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-2">
            <Leaf className="h-8 w-8 text-green-600" />
            {t('page.title')}
          </h1>
          <p className="text-muted-foreground mt-2">{t('page.description')}</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="lg">
          {refreshing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('page.refreshing')}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('page.refresh')}
            </>
          )}
        </Button>
      </div>

      {hasError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Leaf className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">{tCommon('somethingWentWrong')}</h3>
            <p className="text-muted-foreground text-center mb-4">{tCommon('loadFailed')}</p>
            <Button onClick={handleRefresh}>{tCommon('tryAgain')}</Button>
          </CardContent>
        </Card>
      ) : loading && !portfolioAnalysis ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('page.loading')}</p>
          </CardContent>
        </Card>
      ) : portfolioAnalysis ? (
        <>
          {/* Portfolio Summary */}
          <EsgPortfolioSummary analysis={portfolioAnalysis} />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Holdings Breakdown */}
            <div className="lg:col-span-2">
              <EsgHoldingsBreakdown analysis={portfolioAnalysis} />
            </div>

            {/* Insights and Trends */}
            <div className="lg:col-span-1">
              <EsgInsights analysis={portfolioAnalysis} trends={trends} />
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Leaf className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-semibold text-lg mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              {t('empty.description')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
