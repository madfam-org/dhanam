'use client';

import { useTranslation } from '@dhanam/shared';

/** Placeholder press/outlet slots until real press assets are approved. */
const pressSlots = ['slot1', 'slot2', 'slot3', 'slot4'] as const;

export function PressStrip() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-10" aria-labelledby="press-strip-title">
      <p
        id="press-strip-title"
        className="mb-6 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {t('pressStrip.title')}
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-6 md:gap-10">
        {pressSlots.map((slot) => (
          <div
            key={slot}
            className="flex h-10 min-w-[120px] items-center justify-center rounded-md border border-dashed border-border/80 px-4 text-xs font-medium uppercase tracking-widest text-muted-foreground/70"
            aria-hidden
          >
            {t(`pressStrip.${slot}`)}
          </div>
        ))}
      </div>
    </section>
  );
}
