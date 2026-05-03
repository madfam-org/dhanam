'use client';

import { Account, AccountType, Currency, Provider, useTranslation } from '@dhanam/shared';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@dhanam/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  MoreVertical,
  Loader2,
  Building2,
  CreditCard,
  TrendingUp,
  Coins,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import { AccountDetailSheet } from '@/components/accounts/account-detail-sheet';
import { BelvoConnect } from '@/components/providers/belvo-connect';
import { BitsoConnect } from '@/components/providers/bitso-connect';
import { PlaidConnect } from '@/components/providers/plaid-connect';
import { accountsApi } from '@/lib/api/accounts';
import { formatCurrency } from '@/lib/utils';
import { useSpaceStore } from '@/stores/space';

const accountTypeIcons: Record<AccountType, React.ElementType> = {
  checking: Building2,
  savings: Building2,
  credit: CreditCard,
  investment: TrendingUp,
  crypto: Coins,
  other: Building2,
};

export default function AccountsPage() {
  const { t } = useTranslation('accounts');
  const { t: tCommon } = useTranslation('common');
  const { currentSpace } = useSpaceStore();
  const queryClient = useQueryClient();
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isBelvoOpen, setIsBelvoOpen] = useState(false);
  const [isPlaidOpen, setIsPlaidOpen] = useState(false);
  const [isBitsoOpen, setIsBitsoOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [cryptoExpanded, setCryptoExpanded] = useState(false);

  const providerLabels: Record<Provider, string> = {
    belvo: t('provider.belvo'),
    plaid: t('provider.plaid'),
    bitso: t('provider.bitso'),
    manual: t('provider.manual'),
  };

  const {
    data: accounts,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['accounts', currentSpace?.id],
    queryFn: () => {
      if (!currentSpace) throw new Error('No current space');
      return accountsApi.getAccounts(currentSpace.id);
    },
    enabled: !!currentSpace,
  });

  const accountGroups = useMemo(() => {
    if (!accounts) return [];
    const groupConfig: { key: string; label: string; types: AccountType[] }[] = [
      { key: 'checking_savings', label: 'Checking & Savings', types: ['checking', 'savings'] },
      { key: 'credit', label: 'Credit', types: ['credit'] },
      { key: 'investment', label: 'Investment', types: ['investment'] },
      { key: 'crypto', label: 'Crypto', types: ['crypto'] },
      { key: 'other', label: 'Other', types: ['other'] },
    ];
    return groupConfig
      .map((group) => {
        const items = accounts.filter((a) => group.types.includes(a.type));
        const totalBalance = items.reduce((sum, a) => sum + a.balance, 0);
        return { ...group, items, totalBalance };
      })
      .filter((group) => group.items.length > 0);
  }, [accounts]);

  const connectMutation = useMutation({
    mutationFn: (provider: Exclude<Provider, 'manual'>) => {
      if (!currentSpace) throw new Error('No current space');
      return accountsApi.connectAccount(currentSpace.id, { provider });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace?.id] });
      setIsConnectOpen(false);
      toast.success(t('toast.connectSuccess'));
    },
    onError: () => {
      toast.error(t('toast.connectFailed'));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof accountsApi.createAccount>[1]) => {
      if (!currentSpace) throw new Error('No current space');
      return accountsApi.createAccount(currentSpace.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace?.id] });
      setIsCreateOpen(false);
      toast.success(t('toast.createSuccess'));
    },
    onError: () => {
      toast.error(t('toast.createFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => {
      if (!currentSpace) throw new Error('No current space');
      return accountsApi.deleteAccount(currentSpace.id, accountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace?.id] });
      toast.success(t('toast.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('toast.deleteFailed'));
    },
  });

  const handleConnect = (provider: Exclude<Provider, 'manual'>) => {
    setSelectedProvider(provider);
    setIsConnectOpen(false);

    // Route to appropriate provider component
    switch (provider) {
      case 'belvo':
        setIsBelvoOpen(true);
        break;
      case 'plaid':
        setIsPlaidOpen(true);
        break;
      case 'bitso':
        setIsBitsoOpen(true);
        break;
    }
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      name: formData.get('name') as string,
      type: formData.get('type') as AccountType,
      currency: formData.get('currency') as Currency,
      balance: parseFloat(formData.get('balance') as string),
    });
  };

  if (!currentSpace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('page.title')}</h1>
          <p className="text-muted-foreground">{t('page.description')}</p>
        </div>
        <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('button.addAccount')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dialog.addAccount.title')}</DialogTitle>
              <DialogDescription>{t('dialog.addAccount.description')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <h4 className="font-medium">{t('dialog.addAccount.connectProvider')}</h4>
                <div className="grid gap-2">
                  {Object.entries(providerLabels)
                    .filter(([key]) => key !== 'manual')
                    .map(([key, label]) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="justify-start"
                        onClick={() => handleConnect(key as Exclude<Provider, 'manual'>)}
                        disabled={connectMutation.isPending}
                      >
                        {connectMutation.isPending && selectedProvider === key ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {label}
                      </Button>
                    ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('dialog.addAccount.or')}
                  </span>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsConnectOpen(false);
                  setIsCreateOpen(true);
                }}
              >
                {t('button.addManually')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">{tCommon('somethingWentWrong')}</h3>
            <p className="text-muted-foreground text-center mb-4">{tCommon('loadFailed')}</p>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace?.id] })
              }
            >
              {tCommon('tryAgain')}
            </Button>
          </CardContent>
        </Card>
      ) : accounts?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">{t('empty.title')}</h3>
            <p className="text-muted-foreground text-center mb-4">{t('empty.description')}</p>
            <Button onClick={() => setIsConnectOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('empty.addFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {accountGroups.map((group) => {
            const isCrypto = group.key === 'crypto';
            const isExpanded = isCrypto ? cryptoExpanded : true;

            const groupCards = (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.items.map((account) => {
                  const Icon = accountTypeIcons[account.type];
                  return (
                    <Card
                      key={account.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedAccount(account)}
                    >
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(account.id)}
                              className="text-destructive"
                            >
                              {t('action.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">
                            {account.type}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {account.provider}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <div className="text-2xl font-bold">
                            {formatCurrency(account.balance, account.currency)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('card.lastUpdated')}{' '}
                            {new Date(
                              account.lastSyncedAt || account.updatedAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );

            if (isCrypto) {
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    className="flex items-center gap-2 mb-3 text-left"
                    onClick={() => setCryptoExpanded((prev) => !prev)}
                  >
                    {cryptoExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <h3 className="text-lg font-semibold">
                      {group.label} ({group.items.length})
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(group.totalBalance, currentSpace.currency)}
                    </span>
                  </button>
                  {isExpanded && groupCards}
                </div>
              );
            }

            return (
              <div key={group.key}>
                <h3 className="text-lg font-semibold mb-3">
                  {group.label} ({group.items.length})
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {formatCurrency(group.totalBalance, currentSpace.currency)}
                  </span>
                </h3>
                {groupCards}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>{t('dialog.createManual.title')}</DialogTitle>
              <DialogDescription>{t('dialog.createManual.description')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('form.accountName')}</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder={t('form.accountNamePlaceholder')}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">{t('form.accountType')}</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectAccountType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">{t('accountType.checking')}</SelectItem>
                    <SelectItem value="savings">{t('accountType.savings')}</SelectItem>
                    <SelectItem value="credit">{t('accountType.credit')}</SelectItem>
                    <SelectItem value="investment">{t('accountType.investment')}</SelectItem>
                    <SelectItem value="crypto">{t('accountType.crypto')}</SelectItem>
                    <SelectItem value="other">{t('accountType.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">{t('form.currency')}</Label>
                <Select name="currency" required>
                  <SelectTrigger>
                    <SelectValue placeholder={t('form.selectCurrency')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="balance">{t('form.currentBalance')}</Label>
                <Input
                  id="balance"
                  name="balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('button.createAccount')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BelvoConnect
        open={isBelvoOpen}
        onOpenChange={setIsBelvoOpen}
        spaceId={currentSpace.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace.id] });
        }}
      />

      <PlaidConnect
        open={isPlaidOpen}
        onOpenChange={setIsPlaidOpen}
        spaceId={currentSpace.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace.id] });
        }}
      />

      <BitsoConnect
        open={isBitsoOpen}
        onOpenChange={setIsBitsoOpen}
        spaceId={currentSpace.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace.id] });
        }}
      />

      <AccountDetailSheet
        account={selectedAccount}
        open={!!selectedAccount}
        onOpenChange={(open) => {
          if (!open) setSelectedAccount(null);
        }}
        spaceId={currentSpace.id}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['accounts', currentSpace.id] })}
      />
    </div>
  );
}
