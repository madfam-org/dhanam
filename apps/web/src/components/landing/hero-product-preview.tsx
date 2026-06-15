/**
 * Stylized Dhanam dashboard preview for the marketing hero (no external assets).
 */
export function HeroProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none" aria-hidden role="presentation">
      <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" />
      <div className="relative rounded-2xl border border-border/80 bg-card shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/80" />
          <span className="ml-2 text-xs font-medium text-muted-foreground">Dhanam · Net worth</span>
        </div>
        <div className="p-5 space-y-4 bg-gradient-to-b from-card to-muted/20">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total net worth</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">$1,284,520</p>
            <p className="text-sm text-success font-medium">+4.2% this month</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Banking', value: '62%', tone: 'bg-info/15 text-info' },
              { label: 'DeFi', value: '24%', tone: 'bg-primary/15 text-primary' },
              { label: 'Property', value: '14%', tone: 'bg-warning/15 text-warning' },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg px-2 py-3 text-center ${item.tone}`}>
                <p className="text-[10px] uppercase tracking-wide opacity-80">{item.label}</p>
                <p className="text-lg font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {['Groceries · AI categorized', 'SPEI transfer · Recurring', 'ETH staking · DeFi'].map(
              (row) => (
                <div
                  key={row}
                  className="flex items-center justify-between rounded-lg border bg-background/80 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">{row}</span>
                  <span className="font-medium text-foreground">Reviewed</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
