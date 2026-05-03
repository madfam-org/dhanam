'use client';

import { Button } from '@dhanam/ui';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { RebalancingSuggestion, ordersApi } from '../../lib/api/orders';

interface RebalancingDashboardProps {
  spaceId: string;
  goalId: string;
  goalName: string;
}

export function RebalancingDashboard({ spaceId, goalId, goalName }: RebalancingDashboardProps) {
  const [suggestion, setSuggestion] = useState<RebalancingSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await ordersApi.suggestRebalancing(spaceId, goalId);
      setSuggestion(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load rebalancing suggestions');
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, goalId]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleExecuteRebalancing = async () => {
    setIsExecuting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await ordersApi.executeRebalancing(spaceId, goalId);
      setSuccess(result.message);
      await loadSuggestions(); // Reload to show updated state
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to execute rebalancing');
    } finally {
      setIsExecuting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !suggestion) {
    return (
      <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!suggestion) {
    return null;
  }

  const needsRebalancing = suggestion.actions.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rebalancing Recommendations</h3>
          <p className="text-sm text-muted-foreground">for {goalName}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSuggestions} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-success/10 rounded-lg">
          <CheckCircle className="h-5 w-5 text-success" />
          <p className="text-sm text-success">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Total Actions</p>
          <p className="text-2xl font-bold">{suggestion.summary.totalActions}</p>
        </div>

        <div className="p-4 bg-success/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Buy Actions</p>
          <p className="text-2xl font-bold text-success">{suggestion.summary.buyActions}</p>
        </div>

        <div className="p-4 bg-destructive/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Sell Actions</p>
          <p className="text-2xl font-bold text-destructive">{suggestion.summary.sellActions}</p>
        </div>

        <div className="p-4 bg-info/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Estimated Value</p>
          <p className="text-2xl font-bold text-info">
            {formatCurrency(suggestion.summary.estimatedValue)}
          </p>
        </div>
      </div>

      {/* Rebalancing Actions */}
      {needsRebalancing ? (
        <div className="space-y-4">
          <h4 className="font-semibold">Recommended Actions</h4>

          <div className="space-y-2">
            {suggestion.actions.map((action, index) => (
              <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                <div
                  className={`p-2 rounded-lg ${
                    action.action === 'buy'
                      ? 'bg-success/10 text-success'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {action.action === 'buy' ? (
                    <TrendingUp className="h-5 w-5" />
                  ) : (
                    <TrendingDown className="h-5 w-5" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium capitalize">{action.action}</p>
                    {action.assetSymbol && (
                      <span className="px-2 py-0.5 text-xs bg-muted rounded">
                        {action.assetSymbol}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{action.reason}</p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(action.amount)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Executing rebalancing will create {suggestion.actions.length} order(s) to bring your
              portfolio back to target allocations.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="default" onClick={handleExecuteRebalancing} disabled={isExecuting}>
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Execute Rebalancing
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 bg-muted/50 rounded-lg">
          <CheckCircle className="h-12 w-12 text-success mb-4" />
          <h4 className="text-lg font-semibold mb-2">Portfolio is Balanced</h4>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Your portfolio is currently within the target allocation ranges. No rebalancing actions
            are needed at this time.
          </p>
        </div>
      )}
    </div>
  );
}
