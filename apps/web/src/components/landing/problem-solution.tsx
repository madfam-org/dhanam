'use client';

import { useTranslation } from '@dhanam/shared';
import { CheckCircle, X } from 'lucide-react';

const comparisonRows = ['row1', 'row2', 'row3'] as const;

export function ProblemSolution() {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-16 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          {t('problemSolution.title')}
          <br />
          <span className="text-primary">{t('problemSolution.titleHighlight')}</span>
        </h2>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:px-6">
            <span>{t('problemSolution.budgetTrackers')}</span>
            <span className="sr-only">versus</span>
            <span className="text-right text-primary">Dhanam</span>
          </div>

          <ul className="divide-y">
            {comparisonRows.map((row) => (
              <li
                key={row}
                className="grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4 md:px-6"
              >
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 shrink-0 text-destructive mt-0.5" aria-hidden />
                  <span>{t(`problemSolution.${row}Problem`)}</span>
                </div>
                <span
                  className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:block"
                  aria-hidden
                >
                  vs
                </span>
                <div className="flex gap-2 text-sm md:justify-end">
                  <CheckCircle className="h-4 w-4 shrink-0 text-success mt-0.5" aria-hidden />
                  <span>{t(`problemSolution.${row}Solution`)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
