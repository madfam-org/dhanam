'use client';

import { useTranslation } from '@dhanam/shared';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const testimonialKeys = ['quote1', 'quote2', 'quote3', 'quote4', 'quote5', 'quote6'] as const;

export function TestimonialCarousel() {
  const { t } = useTranslation('landing');
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = testimonialKeys.length;

  const next = useCallback(() => {
    setIndex((current) => (current + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setIndex((current) => (current - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (reducedMotion || paused) return;
    const timer = window.setInterval(next, 8000);
    return () => window.clearInterval(timer);
  }, [next, paused, reducedMotion]);

  const key = testimonialKeys[index];

  return (
    <section
      className="container mx-auto px-6 py-16 md:py-20"
      aria-labelledby="testimonials-title"
      aria-live="polite"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="testimonials-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          {t('testimonials.title')}
        </h2>
        <p className="mt-3 text-muted-foreground">{t('testimonials.subtitle')}</p>
      </div>

      <div
        className="relative mx-auto mt-10 max-w-4xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
      >
        <motion.blockquote
          key={key}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border bg-card px-8 py-10 shadow-sm"
        >
          <Quote className="mb-4 h-8 w-8 text-primary/70" aria-hidden />
          <p className="text-lg leading-relaxed md:text-xl">
            &ldquo;{t(`testimonials.${key}.quote`)}&rdquo;
          </p>
          <footer className="mt-6 flex flex-col gap-1 text-sm">
            <cite className="not-italic font-semibold text-foreground">
              {t(`testimonials.${key}.name`)}
            </cite>
            <span className="text-muted-foreground">{t(`testimonials.${key}.role`)}</span>
          </footer>
        </motion.blockquote>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={prev}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
            aria-label={t('testimonials.previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-2" role="tablist" aria-label={t('testimonials.pagination')}>
            {testimonialKeys.map((item, i) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${t('testimonials.goTo')} ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? 'w-8 bg-primary' : 'w-2.5 bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background transition-colors hover:bg-muted"
            aria-label={t('testimonials.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
