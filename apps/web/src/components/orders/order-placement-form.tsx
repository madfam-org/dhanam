'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@/lib/zod-resolver';
import { z } from 'zod';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dhanam/ui';
import { Loader2, AlertCircle, DollarSign } from 'lucide-react';
import {
  CreateOrderDto,
  OrderType,
  OrderPriority,
  ExecutionProvider,
  ordersApi,
} from '../../lib/api/orders';
import { Account } from '@dhanam/shared';

const orderSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  type: z.nativeEnum(OrderType),
  priority: z.nativeEnum(OrderPriority).optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(1, 'Currency is required'),
  assetSymbol: z.string().optional(),
  targetPrice: z.number().positive().optional(),
  toAccountId: z.string().optional(),
  provider: z.nativeEnum(ExecutionProvider),
  dryRun: z.boolean().optional(),
  notes: z.string().optional(),
});

type OrderFormData = z.infer<typeof orderSchema>;

interface OrderPlacementFormProps {
  spaceId: string;
  accounts: Account[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Order shape from API may vary between create/verify flows; parent handles the response
  onSuccess?: (order: any) => void;
  onCancel?: () => void;
  defaultAccountId?: string;
  defaultGoalId?: string;
}

export function OrderPlacementForm({
  spaceId,
  accounts,
  onSuccess,
  onCancel,
  defaultAccountId,
  defaultGoalId,
}: OrderPlacementFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOtpField, setShowOtpField] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      accountId: defaultAccountId || '',
      priority: OrderPriority.normal,
      dryRun: false,
    },
  });

  const selectedAccountId = watch('accountId');
  const orderType = watch('type');
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Auto-set provider and currency based on selected account
  useEffect(() => {
    if (selectedAccount) {
      setValue('provider', selectedAccount.provider as ExecutionProvider);
      setValue('currency', selectedAccount.currency);
    }
  }, [selectedAccount, setValue]);

  const onSubmit = async (data: OrderFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const createOrderDto: CreateOrderDto = {
        ...data,
        idempotencyKey: `web-${Date.now()}-${Math.random()}`,
        ...(defaultGoalId && { goalId: defaultGoalId }),
      };

      const order = await ordersApi.createOrder(spaceId, createOrderDto);

      // Check if OTP verification is required
      if (order.status === 'pending_verification' && !order.otpVerified) {
        setPendingOrderId(order.id);
        setShowOtpField(true);
        setIsLoading(false);
        return;
      }

      // Auto-execute if not in dry-run mode
      if (!data.dryRun) {
        await ordersApi.executeOrder(spaceId, order.id);
      }

      onSuccess?.(order);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
      setIsLoading(false);
    }
  };

  const handleOtpVerification = async () => {
    if (!pendingOrderId || !otpCode) return;

    setIsLoading(true);
    setError(null);

    try {
      const verifiedOrder = await ordersApi.verifyOrder(spaceId, pendingOrderId, { otpCode });

      // Execute the order after verification
      await ordersApi.executeOrder(spaceId, verifiedOrder.id);

      onSuccess?.(verifiedOrder);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify order');
      setIsLoading(false);
    }
  };

  if (showOtpField) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This is a high-value transaction. Please enter your 2FA code to continue.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="otpCode">2FA Code</Label>
          <Input
            id="otpCode"
            type="text"
            placeholder="123456"
            maxLength={6}
            value={otpCode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtpCode(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowOtpField(false);
              setPendingOrderId(null);
              setOtpCode('');
            }}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleOtpVerification}
            disabled={isLoading || !otpCode || otpCode.length !== 6}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify & Execute'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="accountId">Account</Label>
        <Select
          value={selectedAccountId}
          onValueChange={(value: string) => setValue('accountId', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.name} ({account.currency} {account.balance.toFixed(2)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.accountId && <p className="text-sm text-destructive">{errors.accountId.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Order Type</Label>
        <Select
          value={orderType}
          onValueChange={(value: string) => setValue('type', value as OrderType)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select order type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OrderType.buy}>Buy</SelectItem>
            <SelectItem value={OrderType.sell}>Sell</SelectItem>
            <SelectItem value={OrderType.transfer}>Transfer</SelectItem>
            <SelectItem value={OrderType.deposit}>Deposit</SelectItem>
            <SelectItem value={OrderType.withdraw}>Withdraw</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      {(orderType === OrderType.buy || orderType === OrderType.sell) && (
        <div className="space-y-2">
          <Label htmlFor="assetSymbol">Asset Symbol</Label>
          <Input
            id="assetSymbol"
            placeholder="BTC, ETH, etc."
            {...register('assetSymbol')}
            disabled={isLoading}
          />
          {errors.assetSymbol && (
            <p className="text-sm text-destructive">{errors.assetSymbol.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="amount">Amount ({watch('currency') || 'USD'})</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="0.00"
            className="pl-9"
            {...register('amount', { valueAsNumber: true })}
            disabled={isLoading}
          />
        </div>
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>

      {(orderType === OrderType.buy || orderType === OrderType.sell) && (
        <div className="space-y-2">
          <Label htmlFor="targetPrice">
            Target Price (Optional - leave empty for market order)
          </Label>
          <Input
            id="targetPrice"
            type="number"
            step="0.01"
            placeholder="Market price"
            {...register('targetPrice', { valueAsNumber: true })}
            disabled={isLoading}
          />
          {errors.targetPrice && (
            <p className="text-sm text-destructive">{errors.targetPrice.message}</p>
          )}
        </div>
      )}

      {orderType === OrderType.transfer && (
        <div className="space-y-2">
          <Label htmlFor="toAccountId">Destination Account</Label>
          <Select
            value={watch('toAccountId') || ''}
            onValueChange={(value: string) => setValue('toAccountId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select destination account" />
            </SelectTrigger>
            <SelectContent>
              {accounts
                .filter((a) => a.id !== selectedAccountId)
                .map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.currency})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {errors.toAccountId && (
            <p className="text-sm text-destructive">{errors.toAccountId.message}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={watch('priority') || OrderPriority.normal}
          onValueChange={(value: string) => setValue('priority', value as OrderPriority)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OrderPriority.low}>Low</SelectItem>
            <SelectItem value={OrderPriority.normal}>Normal</SelectItem>
            <SelectItem value={OrderPriority.high}>High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Input
          id="notes"
          placeholder="Add notes for this order"
          {...register('notes')}
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="dryRun"
          {...register('dryRun')}
          disabled={isLoading}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="dryRun" className="font-normal cursor-pointer">
          Dry run mode (simulate execution without real transactions)
        </Label>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating order...
            </>
          ) : (
            'Create Order'
          )}
        </Button>
      </div>
    </form>
  );
}
