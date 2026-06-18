'use client';

import { useTranslation } from '@dhanam/shared';
import {
  BasketweaveSurface,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from '@dhanam/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Home, Layers, Loader2, RefreshCw, Scale, Wallet } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';

import {
  capitalStackApi,
  type CapitalPurpose,
  type CapitalStackEntityGroup,
  type OwnerCapitalJournalEntry,
} from '@/lib/api/capital-stack';
import { ApiError } from '@/lib/api/client';

import '@dhanam/ui/patterns/basketweave.css';

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'MXN',
    maximumFractionDigits: 2,
  }).format(amount);
}

function MetricTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: typeof Wallet;
  accent: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card/80 p-5 backdrop-blur-sm',
        'transition-transform duration-300 hover:-translate-y-0.5'
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-serif text-3xl tabular-nums tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <div
          className="rounded-lg border p-2"
          style={{ borderColor: `${accent}55`, background: `${accent}12` }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

function EntityGroupHeader({ group }: { group: CapitalStackEntityGroup }) {
  const personal = group.spaces.find((s) => s.type === 'personal');
  const business = group.spaces.find((s) => s.type === 'business');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-[hsl(38_46%_48%/0.45)] bg-[hsl(38_46%_48%/0.08)]">
        <Home className="mr-1 h-3 w-3" />
        {personal?.name ?? 'Personal'}
      </Badge>
      <span className="text-muted-foreground">↔</span>
      <Badge
        variant="outline"
        className="border-[hsl(168_34%_38%/0.45)] bg-[hsl(168_34%_38%/0.08)]"
      >
        <Building2 className="mr-1 h-3 w-3" />
        {business?.name ?? 'Business'}
      </Badge>
    </div>
  );
}

function JournalTable({
  entries,
  t,
}: {
  entries: OwnerCapitalJournalEntry[];
  t: (key: string) => string;
}) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('journal.empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t('journal.flowType')}</th>
            <th className="px-3 py-2 font-medium">{t('journal.amount')}</th>
            <th className="px-3 py-2 font-medium">{t('journal.status')}</th>
            <th className="px-3 py-2 font-medium">{t('journal.created')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-b border-border/60 transition-colors hover:bg-muted/30"
            >
              <td className="px-3 py-3">
                {t(`flowType.${entry.flowType}` as 'flowType.capital_contribution')}
              </td>
              <td className="px-3 py-3 font-mono tabular-nums">
                {formatMoney(entry.amount, entry.currency)}
              </td>
              <td className="px-3 py-3">
                <Badge variant="secondary" className="font-normal">
                  {t(`status.${entry.status}` as 'status.draft')}
                </Badge>
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {new Date(entry.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CAPITAL_PURPOSES: CapitalPurpose[] = [
  'personal_life',
  'owner_facility',
  'entity_operating',
  'equity_stake',
];

function AccountClassificationPanel({
  entityGroupId,
  t,
}: {
  entityGroupId: string;
  t: (key: string) => string;
}) {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({
    queryKey: ['capital-stack-accounts', entityGroupId],
    queryFn: () => capitalStackApi.listAccounts(entityGroupId),
  });

  const [draft, setDraft] = useState<Record<string, CapitalPurpose>>({});

  const accountSignature =
    accountsQuery.data?.map((a) => `${a.id}:${a.capitalPurpose ?? ''}`).join('|') ?? '';

  useEffect(() => {
    if (!accountsQuery.data?.length) {
      setDraft({});
      return;
    }

    setDraft(
      Object.fromEntries(
        accountsQuery.data.map((a) => [
          a.id,
          (a.capitalPurpose ?? 'personal_life') as CapitalPurpose,
        ])
      )
    );
  }, [accountSignature]);

  const saveMutation = useMutation({
    mutationFn: () =>
      capitalStackApi.bulkCapitalPurpose(
        entityGroupId,
        Object.entries(draft).map(([accountId, capitalPurpose]) => ({ accountId, capitalPurpose }))
      ),
    onSuccess: async () => {
      toast.success(t('accounts.saved'));
      await queryClient.invalidateQueries({ queryKey: ['capital-stack-dashboard', entityGroupId] });
      await queryClient.invalidateQueries({ queryKey: ['capital-stack-accounts', entityGroupId] });
    },
    onError: () => toast.error(t('error')),
  });

  if (accountsQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('accounts.description')}</p>
      <div className="divide-y rounded-lg border">
        {(accountsQuery.data ?? []).map((account) => (
          <div
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{account.name}</p>
              <p className="text-xs text-muted-foreground">
                {account.space.name} · {account.space.type}
              </p>
            </div>
            <select
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              value={draft[account.id] ?? 'personal_life'}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  [account.id]: e.target.value as CapitalPurpose,
                }))
              }
            >
              {CAPITAL_PURPOSES.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {t(`accounts.purpose.${purpose}`)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !(accountsQuery.data?.length ?? 0)}
      >
        {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('accounts.save')}
      </Button>
    </div>
  );
}

export default function CapitalStackPage() {
  const { t } = useTranslation('capitalStack');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const groupsQuery = useQuery({
    queryKey: ['capital-stack-groups'],
    queryFn: () => capitalStackApi.listGroups(),
    retry: (count, error) => {
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        return false;
      }
      return count < 2;
    },
  });

  const activeGroupId = selectedGroupId ?? groupsQuery.data?.[0]?.id ?? null;

  const dashboardQuery = useQuery({
    queryKey: ['capital-stack-dashboard', activeGroupId],
    queryFn: () => capitalStackApi.getDashboard(activeGroupId!),
    enabled: Boolean(activeGroupId),
  });

  const journalQuery = useQuery({
    queryKey: ['capital-stack-journal', activeGroupId],
    queryFn: () => capitalStackApi.listJournal({ entityGroupId: activeGroupId! }),
    enabled: Boolean(activeGroupId),
  });

  const isDisabled = groupsQuery.error instanceof ApiError && groupsQuery.error.status === 403;

  const journalTotal = useMemo(() => {
    const byStatus = dashboardQuery.data?.metrics.journalByStatus ?? {};
    return Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  }, [dashboardQuery.data]);

  const handleRefresh = () => {
    void groupsQuery.refetch();
    void dashboardQuery.refetch();
    void journalQuery.refetch();
  };

  if (groupsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  if (isDisabled) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <Layers className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="font-serif text-2xl">{t('disabled.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('disabled.description')}</p>
      </div>
    );
  }

  if (groupsQuery.isError || !groupsQuery.data?.length) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <Scale className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
        <h1 className="font-serif text-2xl">{t('empty.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('empty.description')}</p>
        <p className="mt-4 text-sm text-muted-foreground">{t('empty.contactOps')}</p>
        {groupsQuery.isError && <p className="mt-4 text-sm text-destructive">{t('error')}</p>}
      </div>
    );
  }

  const activeGroup = groupsQuery.data.find((g) => g.id === activeGroupId) ?? groupsQuery.data[0];
  if (!activeGroup) {
    return null;
  }

  const metrics = dashboardQuery.data?.metrics;

  return (
    <div className="relative min-h-full">
      <BasketweaveSurface
        variant="landing"
        drift
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-40"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl space-y-8 px-1 py-2">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(38_46%_42%)]">
              RFC-6
            </p>
            <h1 className="mt-1 font-serif text-3xl tracking-tight md:text-4xl">{t('title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', dashboardQuery.isFetching && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </header>

        {groupsQuery.data.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {groupsQuery.data.map((group) => (
              <Button
                key={group.id}
                size="sm"
                variant={group.id === activeGroupId ? 'default' : 'outline'}
                onClick={() => setSelectedGroupId(group.id)}
              >
                {group.name}
              </Button>
            ))}
          </div>
        )}

        <Card className="border-[hsl(38_46%_48%/0.25)] bg-card/90 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-xl">{activeGroup.name}</CardTitle>
            <EntityGroupHeader group={activeGroup} />
            {activeGroup.beneficialOwner && (
              <p className="text-sm text-muted-foreground">
                {t('owner')}: {activeGroup.beneficialOwner.name} (
                {activeGroup.beneficialOwner.email})
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricTile
                label={t('metrics.unreconciled')}
                value={metrics?.unreconciledFlows ?? '—'}
                icon={Scale}
                accent="hsl(38 46% 48%)"
              />
              <MetricTile
                label={t('metrics.ownerFacilities')}
                value={metrics?.ownerFacilityAccountCount ?? '—'}
                icon={Wallet}
                accent="hsl(168 34% 38%)"
              />
              <MetricTile
                label={t('metrics.journals')}
                value={journalTotal || '—'}
                icon={Layers}
                accent="hsl(32 40% 52%)"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/95">
          <CardHeader>
            <CardTitle className="font-serif text-lg">{t('accounts.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {activeGroupId && <AccountClassificationPanel entityGroupId={activeGroupId} t={t} />}
          </CardContent>
        </Card>

        <Card className="bg-card/95">
          <CardHeader>
            <CardTitle className="font-serif text-lg">{t('journal.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {journalQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <JournalTable entries={journalQuery.data ?? []} t={t} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
