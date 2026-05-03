'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@dhanam/ui';
import { Brain, TrendingUp, Zap, Clock, DollarSign } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface MlInsights {
  period: string;
  categorization: {
    totalAutoCategorized: number;
    averageConfidence: string;
    period: string;
  };
  splits: {
    period: string;
    totalSplitTransactions: number;
    userStats: Array<{
      userId: string;
      userName: string;
      totalSplits: number;
      averageAmount: string;
      averagePercentage: string;
    }>;
  };
  summary: {
    autoCategorizedTransactions: number;
    splitTransactions: number;
    mlSavingsEstimate: string;
  };
}

interface MlInsightsDashboardProps {
  spaceId: string;
  days?: number;
}

export function MlInsightsDashboard({ spaceId, days = 30 }: MlInsightsDashboardProps) {
  const [insights, setInsights] = useState<MlInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/spaces/${spaceId}/ml/insights?days=${days}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ML insights');
      }

      const data = await response.json();
      setInsights(data);
    } catch (err) {
      console.error('Error fetching ML insights:', err);
      setError('Failed to load ML insights');
    } finally {
      setLoading(false);
    }
  }, [spaceId, days]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{error || 'No data available'}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-8 w-8" />
          AI & Machine Learning Insights
        </h2>
        <p className="text-muted-foreground mt-2">
          Automated intelligence helping you save time and money ({insights.period})
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Categorized</CardTitle>
            <Zap className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.summary.autoCategorizedTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Avg confidence: {insights.categorization.averageConfidence}
            </p>
            <Progress
              value={parseFloat(insights.categorization.averageConfidence) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Smart Splits</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.summary.splitTransactions}</div>
            <p className="text-xs text-muted-foreground">AI-suggested split allocations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.summary.mlSavingsEstimate}</div>
            <p className="text-xs text-muted-foreground">From automated tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="categorization" className="space-y-4">
        <TabsList>
          <TabsTrigger value="categorization">Auto-Categorization</TabsTrigger>
          <TabsTrigger value="splits">Split Predictions</TabsTrigger>
        </TabsList>

        <TabsContent value="categorization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Categorization AI</CardTitle>
              <CardDescription>
                Machine learning automatically categorizes transactions based on merchant,
                description, and historical patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Auto-Categorized:</span>
                  <span className="font-semibold">
                    {insights.categorization.totalAutoCategorized}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Average Confidence:</span>
                  <span className="font-semibold">{insights.categorization.averageConfidence}</span>
                </div>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  How It Works
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Exact merchant matching (90%+ confidence)</li>
                  <li>• Fuzzy merchant matching (75%+ confidence)</li>
                  <li>• Description keyword analysis</li>
                  <li>• Amount-based pattern recognition</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="splits" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Split Prediction AI</CardTitle>
              <CardDescription>
                Learn from past split patterns to suggest how expenses should be divided
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {insights.splits.userStats.map((user) => (
                  <div key={user.userId} className="rounded-lg border p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{user.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.totalSplits} split transactions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${user.averageAmount}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.averagePercentage} avg
                        </p>
                      </div>
                    </div>
                    <Progress value={parseFloat(user.averagePercentage)} className="h-2" />
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-muted p-4">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Prediction Strategies
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Merchant-based patterns (highest confidence)</li>
                  <li>• Category-based patterns (medium confidence)</li>
                  <li>• Overall household split ratios (baseline)</li>
                  <li>• Equal split fallback when no pattern exists</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ML Value Proposition */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            ML Cost Savings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Time Saved</p>
              <p className="text-2xl font-bold text-primary">
                {insights.summary.mlSavingsEstimate}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on 30s/categorization, 2min/split
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Tasks Automated</p>
              <p className="text-2xl font-bold">
                {insights.summary.autoCategorizedTransactions + insights.summary.splitTransactions}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Manual tasks eliminated by AI</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
