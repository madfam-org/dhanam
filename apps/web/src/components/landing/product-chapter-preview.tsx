type ChapterPreviewVariant =
  | 'netWorth'
  | 'spending'
  | 'planning'
  | 'household'
  | 'estate'
  | 'depth';

const variantLabels: Record<ChapterPreviewVariant, string> = {
  netWorth: 'Net worth',
  spending: 'Spending',
  planning: 'Plan',
  household: 'Household',
  estate: 'Life Beat',
  depth: 'Platform',
};

function PreviewChrome({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden role="presentation">
      <div className="absolute -inset-3 rounded-2xl bg-primary/5 blur-xl" />
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-destructive/70" />
          <span className="h-2 w-2 rounded-full bg-warning/80" />
          <span className="h-2 w-2 rounded-full bg-success/80" />
          <span className="ml-1 text-[10px] font-medium text-muted-foreground">
            Dhanam · {label}
          </span>
        </div>
        <div className="bg-gradient-to-b from-card to-muted/20 p-4">{children}</div>
      </div>
    </div>
  );
}

function NetWorthPreview() {
  return (
    <PreviewChrome label={variantLabels.netWorth}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total net worth</p>
      <p className="text-2xl font-bold tracking-tight">$1,284,520</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[
          { label: 'Bank', pct: '62%', tone: 'bg-info/15 text-info' },
          { label: 'DeFi', pct: '24%', tone: 'bg-primary/15 text-primary' },
          { label: 'Home', pct: '14%', tone: 'bg-warning/15 text-warning' },
        ].map((item) => (
          <div key={item.label} className={`rounded-md px-1 py-2 text-center ${item.tone}`}>
            <p className="text-[9px] uppercase opacity-80">{item.label}</p>
            <p className="text-sm font-semibold">{item.pct}</p>
          </div>
        ))}
      </div>
    </PreviewChrome>
  );
}

function SpendingPreview() {
  return (
    <PreviewChrome label={variantLabels.spending}>
      <div className="space-y-2">
        {[
          { merchant: 'Superama', cat: 'Groceries · AI', amt: '-$842' },
          { merchant: 'Netflix', cat: 'Subscriptions · Recurring', amt: '-$299' },
          { merchant: 'SPEI · Rent', cat: 'Housing · Rule matched', amt: '-$12,500' },
        ].map((row) => (
          <div
            key={row.merchant}
            className="flex items-center justify-between rounded-lg border bg-background/80 px-2.5 py-2 text-[11px]"
          >
            <div>
              <p className="font-medium text-foreground">{row.merchant}</p>
              <p className="text-muted-foreground">{row.cat}</p>
            </div>
            <span className="font-semibold text-expense">{row.amt}</span>
          </div>
        ))}
      </div>
    </PreviewChrome>
  );
}

function PlanningPreview() {
  return (
    <PreviewChrome label={variantLabels.planning}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Retirement at 55 · probability
      </p>
      <p className="text-2xl font-bold text-success">78%</p>
      <div className="mt-3 h-16 rounded-lg border bg-background/80 p-2">
        <div className="flex h-full items-end gap-0.5">
          {[32, 48, 55, 62, 71, 78, 74, 68, 82, 78].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm bg-primary/30" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        10,000 Monte Carlo paths · 12 stress tests
      </p>
    </PreviewChrome>
  );
}

function HouseholdPreview() {
  return (
    <PreviewChrome label={variantLabels.household}>
      <div className="flex gap-2">
        {[
          { label: 'Yours', amt: '$42,180', tone: 'border-info/40 bg-info/10' },
          { label: 'Mine', amt: '$38,920', tone: 'border-primary/40 bg-primary/10' },
          { label: 'Ours', amt: '$1.2M', tone: 'border-warning/40 bg-warning/10' },
        ].map((item) => (
          <div key={item.label} className={`flex-1 rounded-lg border p-2 ${item.tone}`}>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold">{item.amt}</p>
          </div>
        ))}
      </div>
    </PreviewChrome>
  );
}

function EstatePreview() {
  return (
    <PreviewChrome label={variantLabels.estate}>
      <div className="space-y-2">
        <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2">
          <p className="text-[10px] font-medium text-success">Life Beat active</p>
          <p className="text-[11px] text-muted-foreground">
            Executor access · last check-in 3 days ago
          </p>
        </div>
        <div className="rounded-lg border bg-background/80 px-3 py-2 text-[11px]">
          <p className="font-medium">Digital will · 4 documents</p>
          <p className="text-muted-foreground">Encrypted vault · beneficiary verified</p>
        </div>
      </div>
    </PreviewChrome>
  );
}

function DepthPreview() {
  return (
    <PreviewChrome label={variantLabels.depth}>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'DeFi', sub: '7 networks', tone: 'text-primary' },
          { label: 'Collectibles', sub: '7 categories', tone: 'text-warning' },
          { label: 'Cashflow', sub: '60-day forecast', tone: 'text-info' },
          { label: 'ESG', sub: 'Crypto scores', tone: 'text-success' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-background/80 px-2 py-2">
            <p className={`text-xs font-semibold ${item.tone}`}>{item.label}</p>
            <p className="text-[10px] text-muted-foreground">{item.sub}</p>
          </div>
        ))}
      </div>
    </PreviewChrome>
  );
}

const previewMap: Record<ChapterPreviewVariant, () => React.ReactElement> = {
  netWorth: NetWorthPreview,
  spending: SpendingPreview,
  planning: PlanningPreview,
  household: HouseholdPreview,
  estate: EstatePreview,
  depth: DepthPreview,
};

export function ProductChapterPreview({ variant }: { variant: ChapterPreviewVariant }) {
  const Preview = previewMap[variant];
  return <Preview />;
}

export type { ChapterPreviewVariant };
