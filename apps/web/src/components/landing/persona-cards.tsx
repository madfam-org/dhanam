'use client';

import type { LandingLocale } from '@dhanam/shared';
import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { ArrowRight } from 'lucide-react';

import { PersonaAvatar } from '@/components/landing/persona-avatar';
import {
  landingPersonas,
  resolveDemoPersonaKey,
  type LandingPersonaKey,
} from '@/components/landing/persona-config';
import { ProductChapterPreview } from '@/components/landing/product-chapter-preview';
import { useAnalytics } from '@/hooks/useAnalytics';
import { usePublicAppUrl } from '@/hooks/usePublicSurface';
import { buildAppDemoLaunchUrl } from '@/lib/demo/launch-demo';

interface PersonaCardsProps {
  locale: LandingLocale;
}

export function PersonaCards({ locale }: PersonaCardsProps) {
  const { t } = useTranslation('landing');
  const analytics = useAnalytics();
  const appUrl = usePublicAppUrl();

  const handlePersonaClick = (persona: LandingPersonaKey) => {
    analytics.track('persona_card_clicked', { persona, locale });
  };

  return (
    <section
      className="container mx-auto px-6 py-16 md:py-24"
      aria-labelledby="persona-cards-title"
    >
      <div className="mb-12 mx-auto max-w-2xl text-center">
        <h2 id="persona-cards-title" className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
          {t('personaCards.title')}
        </h2>
        <p className="text-muted-foreground md:text-lg">{t('personaCards.subtitle')}</p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {landingPersonas.map((persona) => {
          const demoKey = resolveDemoPersonaKey(persona.key);
          const href = buildAppDemoLaunchUrl(appUrl, demoKey);

          return (
            <article
              key={persona.key}
              className="group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg motion-reduce:hover:translate-y-0"
            >
              <div className="mb-4 flex items-start gap-3">
                <PersonaAvatar persona={persona.key} />
                <div className="min-w-0 pt-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {t(`personaCards.${persona.key}.archetype`)}
                  </p>
                  <p className="mt-1 text-sm text-destructive/90 dark:text-destructive/80">
                    {t(`personaCards.${persona.key}.pain`)}
                  </p>
                </div>
              </div>

              <p className="mb-5 flex-1 text-sm font-medium leading-relaxed">
                {t(`personaCards.${persona.key}.superpower`)}
              </p>

              <a
                href={href}
                onClick={() => handlePersonaClick(persona.key)}
                className="relative z-10 mt-auto"
              >
                <Button variant="outline" className="w-full gap-2" size="sm">
                  {t(`personaCards.${persona.key}.cta`)}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Button>
              </a>

              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 top-16 flex items-end justify-center bg-gradient-to-t from-card via-card/95 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:group-hover:opacity-100"
                aria-hidden
              >
                <div className="w-full max-w-[220px] origin-bottom scale-[0.72]">
                  <ProductChapterPreview variant={persona.preview} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
