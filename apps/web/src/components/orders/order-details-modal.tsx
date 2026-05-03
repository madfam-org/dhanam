'use client';

import { Button } from '@dhanam/ui';
import { Loader2, X, AlertCircle, Copy } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { TransactionOrder, OrderExecution, OrderStatus, ordersApi } from '../../lib/api/orders';

interface OrderDetailsModalProps {
  spaceId: string;
  orderId: string;
  onClose: () => void;
}

export function OrderDetailsModal({ spaceId, orderId, onClose }: OrderDetailsModalProps) {
  const [order, setOrder] = useState<TransactionOrder | null>(null);
  const [executions, setExecutions] = useState<OrderExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadOrderDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [orderData, executionsData] = await Promise.all([
        ordersApi.getOrder(spaceId, orderId),
        ordersApi.getOrderExecutions(spaceId, orderId),
      ]);

      setOrder(orderData);
      setExecutions(executionsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load order details');
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, orderId]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  const handleCancel = async () => {
    if (!order) return;

    setIsCancelling(true);
    try {
      const cancelled = await ordersApi.cancelOrder(spaceId, orderId);
      setOrder(cancelled);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error || 'Order not found'}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  const canCancel = [OrderStatus.pending_verification, OrderStatus.pending_execution].includes(
    order.status
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold capitalize">{order.type} Order</h2>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`px-2 py-1 text-xs rounded capitalize ${
                  order.status === OrderStatus.completed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : order.status === OrderStatus.failed || order.status === OrderStatus.rejected
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}
              >
                {order.status.replace('_', ' ')}
              </span>
              {order.dryRun && (
                <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                  Dry Run
                </span>
              )}
              {order.autoExecute && (
                <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                  Auto Execute
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Order Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="font-medium">{formatCurrency(order.amount, order.currency)}</p>
            </div>

            {order.assetSymbol && (
              <div>
                <p className="text-sm text-muted-foreground">Asset</p>
                <p className="font-medium">{order.assetSymbol}</p>
              </div>
            )}

            {order.targetPrice && (
              <div>
                <p className="text-sm text-muted-foreground">Target Price</p>
                <p className="font-medium">{formatCurrency(order.targetPrice, order.currency)}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Provider</p>
              <p className="font-medium capitalize">{order.provider}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Priority</p>
              <p className="font-medium capitalize">{order.priority}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">{formatDate(order.createdAt)}</p>
            </div>

            {order.executedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Executed</p>
                <p className="font-medium">{formatDate(order.executedAt)}</p>
              </div>
            )}
          </div>

          {/* Execution Results */}
          {(order.executedAmount || order.fees) && (
            <div className="space-y-2">
              <h3 className="font-semibold">Execution Results</h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                {order.executedAmount && (
                  <div>
                    <p className="text-sm text-muted-foreground">Executed Amount</p>
                    <p className="font-medium">
                      {formatCurrency(order.executedAmount, order.currency)}
                    </p>
                  </div>
                )}

                {order.executedPrice && (
                  <div>
                    <p className="text-sm text-muted-foreground">Executed Price</p>
                    <p className="font-medium">
                      {formatCurrency(order.executedPrice, order.currency)}
                    </p>
                  </div>
                )}

                {order.fees && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fees</p>
                    <p className="font-medium">
                      {formatCurrency(order.fees, order.feeCurrency || order.currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {order.errorMessage && (
            <div className="p-4 bg-destructive/10 rounded-lg">
              <p className="text-sm font-medium text-destructive mb-1">Error</p>
              <p className="text-sm text-destructive">{order.errorMessage}</p>
              {order.errorCode && (
                <p className="text-xs text-muted-foreground mt-1">Code: {order.errorCode}</p>
              )}
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div>
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {/* Order ID */}
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded">
            <code className="text-xs flex-1 overflow-x-auto">{order.id}</code>
            <button
              onClick={() => copyToClipboard(order.id)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          {/* Execution History */}
          {executions.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Execution History</h3>
              <div className="space-y-2">
                {executions.map((execution, _index) => (
                  <div key={execution.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Attempt #{execution.attempt}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          execution.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {execution.status}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {formatDate(execution.startedAt)}
                      {execution.executionTime && <span> • {execution.executionTime}ms</span>}
                    </div>

                    {execution.errorMessage && (
                      <p className="text-xs text-destructive">{execution.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6 pt-6 border-t">
          {canCancel && (
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel Order'
              )}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="ml-auto">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
