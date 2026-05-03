'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { ArrowRight } from 'lucide-react';

const personas = [
  { key: 'maria' as const, emoji: '🧑‍💼' },
  { key: 'carlos' as const, emoji: '🏪' },
  { key: 'diego' as const, emoji: '🎮' },
  { key: 'patricia' as const, emoji: '💎' },
] as const;

export function PersonaCards() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">{t('personaCards.title')}</h2>
        <p className="text-muted-foreground">{t('personaCards.subtitle')}</p>
      </div>

      <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {personas.map((persona) => (
          <div
            key={persona.key}
            className="rounded-lg border bg-card p-6 hover:shadow-lg transition-shadow flex flex-col"
          >
            <div className="text-3xl mb-3">{persona.emoji}</div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t(`personaCards.${persona.key}.archetype`)}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">
              {t(`personaCards.${persona.key}.pain`)}
            </p>
            <p className="text-sm font-medium mb-4 flex-1">
              {t(`personaCards.${persona.key}.superpower`)}
            </p>
            <a href={`/demo?persona=${persona.key}`}>
              <Button variant="outline" className="w-full gap-2" size="sm">
                {t(`personaCards.${persona.key}.cta`)}
                <ArrowRight className="h-3 w-3" />
              </Button>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
