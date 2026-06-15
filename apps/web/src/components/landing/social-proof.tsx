'use client';

import { useTranslation, I18nContext } from '@dhanam/shared';
import { ExternalLink } from 'lucide-react';
import { useContext } from 'react';

import { PartnerLogo } from '@/components/landing/partner-logos';

export function SocialProof() {
  const { t } = useTranslation('landing');
  const i18n = useContext(I18nContext);

  const translations = i18n?.translations as
    | Record<
        string,
        {
          landing?: {
            trustSignals?: {
              partners?: string[];
            };
          };
        }
      >
    | undefined;
  const partners: string[] =
    translations?.[i18n?.locale ?? 'en']?.landing?.trustSignals?.partners ?? [];

  return (
    <section className="container mx-auto px-6 py-16 bg-muted/30">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h2 className="text-3xl font-bold">{t('trustSignals.title')}</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {partners.map((partner) => (
            <div key={partner} className="group flex flex-col items-center gap-3">
              <div className="flex h-14 w-full items-center justify-center rounded-lg border bg-card px-3 transition-colors group-hover:border-primary/30 group-hover:bg-background">
                <PartnerLogo name={partner} />
              </div>
              <span className="sr-only">{partner}</span>
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/5 px-4 py-2 text-sm">
          <ExternalLink className="h-4 w-4 text-success" aria-hidden />
          <span className="font-medium text-success">{t('trustSignals.openSource')}</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {t('trustSignals.openSourceDescription')}
        </p>
      </div>
    </section>
  );
}
