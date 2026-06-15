'use client';

import { useTranslation } from '@dhanam/shared';
import {
  Landmark,
  Coins,
  Home,
  Gamepad2,
  Cpu,
  HeartPulse,
  Search,
  Wallet,
  TrendingUp,
  Users,
  FileText,
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

const featureConfig = [
  { key: 'feature1' as const, icon: Landmark, tone: 'bg-info/15 text-info' },
  { key: 'feature2' as const, icon: Coins, tone: 'bg-primary/15 text-primary' },
  { key: 'feature3' as const, icon: Home, tone: 'bg-warning/15 text-warning' },
  { key: 'feature4' as const, icon: Gamepad2, tone: 'bg-info/15 text-info' },
  { key: 'feature5' as const, icon: Cpu, tone: 'bg-primary/15 text-primary' },
  { key: 'feature6' as const, icon: HeartPulse, tone: 'bg-success/15 text-success' },
  { key: 'feature7' as const, icon: Search, tone: 'bg-warning/15 text-warning' },
  { key: 'feature8' as const, icon: Wallet, tone: 'bg-info/15 text-info' },
  { key: 'feature9' as const, icon: TrendingUp, tone: 'bg-primary/15 text-primary' },
  { key: 'feature10' as const, icon: Users, tone: 'bg-success/15 text-success' },
  { key: 'feature11' as const, icon: FileText, tone: 'bg-warning/15 text-warning' },
  { key: 'feature12' as const, icon: Trophy, tone: 'bg-primary/15 text-primary' },
] as const;

export function FeaturesGrid() {
  const { t } = useTranslation('landing');
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-4">{t('features.title')}</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">{t('features.subtitle')}</p>
      </div>

      {!expanded ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('features.showAll')}
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featureConfig.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.key}
                    className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow"
                  >
                    <div
                      className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 ${feature.tone}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h4 className="text-lg font-semibold mb-2">
                      {t(`features.${feature.key}.title`)}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {t(`features.${feature.key}.description`)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('features.hideAll')}
              <ChevronUp className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
