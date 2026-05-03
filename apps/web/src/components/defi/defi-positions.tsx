'use client';

import {
  Coins,
  TrendingUp,
  RefreshCw,
  Loader2,
  Wallet,
  Layers,
  PiggyBank,
  ArrowUpDown,
  Landmark,
  Factory,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  getSpaceDeFiSummary,
  syncAllDeFiPositions,
  type SpaceDeFiSummary,
  type DeFiPosition,
  type DeFiAccountSummary,
} from '@/lib/api/defi';

const formatUsd = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(2)}%`;
};

const positionTypeIcons: Record<string, React.ReactNode> = {
  'liquidity-pool': <Layers className="h-4 w-4" />,
  lending: <PiggyBank className="h-4 w-4" />,
  borrowing: <ArrowUpDown className="h-4 w-4" />,
  staking: <Lock className="h-4 w-4" />,
  farming: <Factory className="h-4 w-4" />,
  vault: <Landmark className="h-4 w-4" />,
};

const positionTypeLabels: Record<string, string> = {
  'liquidity-pool': 'Liquidity Pool',
  lending: 'Lending',
  borrowing: 'Borrowing',
  staking: 'Staking',
  farming: 'Yield Farming',
  vault: 'Vault',
};

const protocolColors: Record<string, string> = {
  'uniswap-v2': 'bg-pink-500/10 text-pink-600',
  'uniswap-v3': 'bg-pink-500/10 text-pink-600',
  'aave-v2': 'bg-purple-500/10 text-purple-600',
  'aave-v3': 'bg-purple-500/10 text-purple-600',
  'compound-v2': 'bg-green-500/10 text-green-600',
  'compound-v3': 'bg-green-500/10 text-green-600',
  curve: 'bg-blue-500/10 text-blue-600',
  lido: 'bg-cyan-500/10 text-cyan-600',
  yearn: 'bg-blue-500/10 text-blue-600',
  maker: 'bg-teal-500/10 text-teal-600',
  convex: 'bg-orange-500/10 text-orange-600',
  balancer: 'bg-indigo-500/10 text-indigo-600',
  sushiswap: 'bg-pink-500/10 text-pink-600',
  other: 'bg-gray-500/10 text-gray-600',
};

function PositionCard({ position }: { position: DeFiPosition }) {
  const protocolClass = protocolColors[position.protocol] || protocolColors.other;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {positionTypeIcons[position.type] || <Coins className="h-4 w-4" />}
            <div>
              <p className="font-medium text-sm">{position.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={protocolClass}>
                  {position.protocol.replace('-', ' ').toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {positionTypeLabels[position.type] || position.type}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatUsd(position.balanceUsd)}</p>
            {position.apy && (
              <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                <TrendingUp className="h-3 w-3" />
                {formatPercent(position.apy)} APY
              </p>
            )}
          </div>
        </div>

        {/* Tokens */}
        {position.tokens.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-2">
              {position.tokens.map((token, idx) => (
                <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-medium">{token.symbol}</span>
                  <span>({formatUsd(token.balanceUsd)})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Factor for lending/borrowing */}
        {position.healthFactor && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Health Factor</span>
              <span
                className={
                  position.healthFactor > 1.5
                    ? 'text-green-600'
                    : position.healthFactor > 1.2
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }
              >
                {position.healthFactor.toFixed(2)}
              </span>
            </div>
            <Progress value={Math.min(position.healthFactor / 3, 1) * 100} className="h-1 mt-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AccountSection({
  account,
  isExpanded,
  onToggle,
}: {
  account: DeFiAccountSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="mb-2">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <div className="text-left">
            <p className="font-medium">{account.accountName}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {account.walletAddress.slice(0, 6)}...{account.walletAddress.slice(-4)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{formatUsd(account.totalValueUsd)}</p>
            <p className="text-xs text-muted-foreground">
              {account.positionCount} position{account.positionCount !== 1 ? 's' : ''}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>
      {isExpanded && (
        <CardContent className="pt-0 pb-4">
          <div className="grid gap-3 mt-2">
            {account.positions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
            {account.positions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No DeFi positions found for this wallet
              </p>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface DeFiPositionsProps {
  spaceId: string;
  initialData?: SpaceDeFiSummary | null;
}

export function DeFiPositions({ spaceId, initialData }: DeFiPositionsProps) {
  const [data, setData] = useState<SpaceDeFiSummary | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const summary = await getSpaceDeFiSummary(spaceId);
      setData(summary);
      // Expand all accounts by default
      setExpandedAccounts(new Set(summary.accounts.map((a) => a.accountId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DeFi positions');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      await syncAllDeFiPositions(spaceId);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync DeFi positions');
    } finally {
      setSyncing(false);
    }
  };

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Load data on mount if not provided
  useEffect(() => {
    if (!initialData) {
      fetchData();
    } else {
      // Expand all accounts by default
      setExpandedAccounts(new Set(initialData.accounts.map((a) => a.accountId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reason: Intentionally run once on mount; fetchData and initialData are stable for the component's lifetime
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            DeFi Positions
          </CardTitle>
          <CardDescription>
            Track your DeFi positions across multiple protocols and networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Coins className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No crypto accounts with DeFi positions found.
              <br />
              Add a crypto account with a wallet address to start tracking.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate protocol breakdown percentages
  const protocolEntries = Object.entries(data.byProtocol).sort(
    (a, b) => b[1].valueUsd - a[1].valueUsd
  );
  const typeEntries = Object.entries(data.byType).sort((a, b) => b[1].valueUsd - a[1].valueUsd);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                DeFi Positions
              </CardTitle>
              <CardDescription>
                Aggregated DeFi positions across {data.accounts.length} wallet
                {data.accounts.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Total DeFi Value</p>
              <p className="text-2xl font-bold">{formatUsd(data.totalValueUsd)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Total Borrowed</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatUsd(data.totalBorrowedUsd)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Net DeFi Worth</p>
              <p className="text-2xl font-bold text-green-600">{formatUsd(data.netWorthUsd)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Protocol */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Protocol</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {protocolEntries.map(([protocol, stats]) => {
                const percentage = (stats.valueUsd / data.totalValueUsd) * 100;
                const colorClass = protocolColors[protocol] || protocolColors.other;
                return (
                  <div key={protocol}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={colorClass}>
                        {protocol.replace('-', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium">{formatUsd(stats.valueUsd)}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Position Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {typeEntries.map(([type, stats]) => {
                const percentage = (stats.valueUsd / data.totalValueUsd) * 100;
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {positionTypeIcons[type] || <Coins className="h-4 w-4" />}
                        <span className="text-sm">{positionTypeLabels[type] || type}</span>
                      </div>
                      <span className="text-sm font-medium">{formatUsd(stats.valueUsd)}</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Account Positions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Positions by Wallet</h3>
        <div>
          {data.accounts.map((account) => (
            <AccountSection
              key={account.accountId}
              account={account}
              isExpanded={expandedAccounts.has(account.accountId)}
              onToggle={() => toggleAccount(account.accountId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
