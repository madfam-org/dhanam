'use client';

import { useTranslation, I18nContext } from '@dhanam/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useContext } from 'react';

const sections = ['defi', 'collectibles', 'scenarios'] as const;

export function PlatformDepth() {
  const { t } = useTranslation('landing');
  const i18n = useContext(I18nContext);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const translations = i18n?.translations as
    | Record<
        string,
        {
          landing?: {
            platformDepth?: Record<
              string,
              {
                items?: string[];
                protocols?: string;
                title?: string;
              }
            >;
          };
        }
      >
    | undefined;
  const lang = translations?.[i18n?.locale ?? 'en']?.landing?.platformDepth;

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">{t('platformDepth.title')}</h2>
        <p className="text-muted-foreground">{t('platformDepth.subtitle')}</p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
        {sections.map((section) => {
          const items: string[] = lang?.[section]?.items ?? [];
          const isOpen = expanded[section] ?? false;
          const protocols: string | undefined = lang?.[section]?.protocols;

          return (
            <div key={section} className="rounded-lg border bg-card overflow-hidden">
              <button
                onClick={() => toggle(section)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
              >
                <h4 className="text-lg font-semibold">{t(`platformDepth.${section}.title`)}</h4>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-6 pb-6 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                  {protocols && <p className="text-xs text-muted-foreground pt-2">{protocols}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
