'use client';

import { useTranslation } from '@dhanam/shared';
import { motion, useReducedMotion } from 'framer-motion';

const statKeys = ['stat1', 'stat2', 'stat3', 'stat4'] as const;

export function StatsBar() {
  const { t } = useTranslation('landing');
  const reducedMotion = useReducedMotion();

  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.5 },
      };

  return (
    <section className="border-y border-border/60 bg-muted/20" aria-labelledby="stats-bar-title">
      <h2 id="stats-bar-title" className="sr-only">
        {t('statsBar.title')}
      </h2>
      <div className="container mx-auto px-6 py-10">
        <motion.div
          {...motionProps}
          className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          {statKeys.map((key) => (
            <div key={key} className="text-center">
              <p className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
                {t(`statsBar.${key}.value`)}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {t(`statsBar.${key}.label`)}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
