'use client';

import { useTranslation } from '@dhanam/shared';
import { Shield, KeyRound, Eye, ClipboardList } from 'lucide-react';

const pillars = [
  { key: 'encryption' as const, icon: Shield, tone: 'bg-info/15 text-info' },
  { key: 'authentication' as const, icon: KeyRound, tone: 'bg-primary/15 text-primary' },
  { key: 'readOnly' as const, icon: Eye, tone: 'bg-success/15 text-success' },
  { key: 'auditTrail' as const, icon: ClipboardList, tone: 'bg-warning/15 text-warning' },
] as const;

export function SecurityTrust() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-16 bg-muted/30">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">{t('securityTrust.title')}</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">{t('securityTrust.subtitle')}</p>
        <p className="mt-4 inline-flex rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
          {t('securityTrust.neverSold')}
        </p>
      </div>

      <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div key={pillar.key} className="rounded-lg border bg-card p-6 text-center">
              <div
                className={`h-12 w-12 rounded-lg flex items-center justify-center mb-4 mx-auto ${pillar.tone}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h4 className="text-lg font-semibold mb-2">
                {t(`securityTrust.${pillar.key}.title`)}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t(`securityTrust.${pillar.key}.description`)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
