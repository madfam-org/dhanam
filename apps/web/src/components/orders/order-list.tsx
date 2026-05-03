'use client';

import { Button } from '@dhanam/ui';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Receipt,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import {
  TransactionOrder,
  OrderType,
  OrderStatus,
  ordersApi,
  OrderFilterDto,
} from '../../lib/api/orders';

interface OrderListProps {
  spaceId: string;
  filters?: OrderFilterDto;
  onOrderClick?: (order: TransactionOrder) => void;
}

const orderTypeIcons = {
  [OrderType.buy]: TrendingUp,
  [OrderType.sell]: TrendingDown,
  [OrderType.transfer]: ArrowRightLeft,
  [OrderType.deposit]: ArrowDownToLine,
  [OrderType.withdraw]: ArrowUpFromLine,
};

const orderTypeColors = {
  [OrderType.buy]: 'text-green-600 dark:text-green-400',
  [OrderType.sell]: 'text-red-600 dark:text-red-400',
  [OrderType.transfer]: 'text-blue-600 dark:text-blue-400',
  [OrderType.deposit]: 'text-purple-600 dark:text-purple-400',
  [OrderType.withdraw]: 'text-orange-600 dark:text-orange-400',
};

const statusIcons = {
  [OrderStatus.pending_verification]: Clock,
  [OrderStatus.pending_execution]: Clock,
  [OrderStatus.executing]: Loader2,
  [OrderStatus.completed]: CheckCircle,
  [OrderStatus.failed]: XCircle,
  [OrderStatus.cancelled]: XCircle,
  [OrderStatus.rejected]: AlertCircle,
};

const statusColors = {
  [OrderStatus.pending_verification]: 'text-amber-600 dark:text-amber-400',
  [OrderStatus.pending_execution]: 'text-blue-600 dark:text-blue-400',
  [OrderStatus.executing]: 'text-blue-600 dark:text-blue-400',
  [OrderStatus.completed]: 'text-green-600 dark:text-green-400',
  [OrderStatus.failed]: 'text-red-600 dark:text-red-400',
  [OrderStatus.cancelled]: 'text-gray-600 dark:text-gray-400',
  [OrderStatus.rejected]: 'text-red-600 dark:text-red-400',
};

export function OrderList({ spaceId, filters, onOrderClick }: OrderListProps) {
  const [orders, setOrders] = useState<TransactionOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await ordersApi.getOrders(spaceId, {
        ...filters,
        page,
        limit,
      });

      setOrders(response.orders);
      setTotal(response.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [spaceId, filters, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-destructive/10 rounded-lg">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No orders found</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Orders will appear here when you make purchases or transfers
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-border rounded-lg border">
        {orders.map((order) => {
          const TypeIcon = orderTypeIcons[order.type];
          const StatusIcon = statusIcons[order.status];
          const typeColor = orderTypeColors[order.type];
          const statusColor = statusColors[order.status];

          return (
            <div
              key={order.id}
              className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onOrderClick?.(order)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOrderClick?.(order);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg bg-muted ${typeColor}`}>
                    <TypeIcon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium capitalize">{order.type}</h4>
                      {order.dryRun && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          Dry Run
                        </span>
                      )}
                      {order.autoExecute && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          Auto
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {order.assetSymbol && <span>{order.assetSymbol} • </span>}
                      {formatCurrency(order.amount, order.currency)}
                      {order.targetPrice && (
                        <span> @ {formatCurrency(order.targetPrice, order.currency)}</span>
                      )}
                    </div>

                    {order.notes && <p className="text-sm text-muted-foreground">{order.notes}</p>}

                    <div className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className={`flex items-center gap-1.5 ${statusColor}`}>
                    <StatusIcon
                      className={`h-4 w-4 ${
                        order.status === OrderStatus.executing ? 'animate-spin' : ''
                      }`}
                    />
                    <span className="text-sm font-medium capitalize">
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>

                  {order.executedAmount && (
                    <div className="text-sm text-muted-foreground">
                      Executed: {formatCurrency(order.executedAmount, order.currency)}
                    </div>
                  )}

                  {order.fees && (
                    <div className="text-xs text-muted-foreground">
                      Fee: {formatCurrency(order.fees, order.feeCurrency || order.currency)}
                    </div>
                  )}
                </div>
              </div>

              {order.errorMessage && (
                <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                  {order.errorMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page * limit >= total || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
