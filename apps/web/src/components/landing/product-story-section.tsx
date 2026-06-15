'use client';

import { useTranslation } from '@dhanam/shared';
import { motion, useReducedMotion } from 'framer-motion';

import {
  ProductChapterPreview,
  type ChapterPreviewVariant,
} from '@/components/landing/product-chapter-preview';

const chapters: { key: string; preview: ChapterPreviewVariant }[] = [
  { key: 'chapter1', preview: 'netWorth' },
  { key: 'chapter2', preview: 'spending' },
  { key: 'chapter3', preview: 'planning' },
  { key: 'chapter4', preview: 'household' },
  { key: 'chapter5', preview: 'estate' },
  { key: 'chapter6', preview: 'depth' },
];

function StoryChapter({
  chapterKey,
  preview,
  index,
}: {
  chapterKey: string;
  preview: ChapterPreviewVariant;
  index: number;
}) {
  const { t } = useTranslation('landing');
  const reducedMotion = useReducedMotion();
  const reversed = index % 2 === 1;

  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 28 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <motion.article
      {...motionProps}
      className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
      aria-labelledby={`${chapterKey}-title`}
    >
      <div className={reversed ? 'lg:order-2' : 'lg:order-1'}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
          {t(`productStory.${chapterKey}.eyebrow`)}
        </p>
        <h3 id={`${chapterKey}-title`} className="text-2xl font-bold tracking-tight md:text-3xl">
          {t(`productStory.${chapterKey}.title`)}
        </h3>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          {t(`productStory.${chapterKey}.description`)}
        </p>
      </div>
      <div className={reversed ? 'lg:order-1' : 'lg:order-2'}>
        <ProductChapterPreview variant={preview} />
      </div>
    </motion.article>
  );
}

export function ProductStorySection() {
  const { t } = useTranslation('landing');
  const reducedMotion = useReducedMotion();

  const headerMotion = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.45 },
      };

  return (
    <section
      id="features"
      className="container mx-auto px-6 py-16 md:py-24"
      aria-labelledby="product-story-title"
    >
      <motion.div {...headerMotion} className="mx-auto mb-16 max-w-2xl text-center">
        <h2 id="product-story-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          {t('productStory.title')}
        </h2>
        <p className="mt-4 text-muted-foreground md:text-lg">{t('productStory.subtitle')}</p>
      </motion.div>

      <div className="mx-auto max-w-5xl space-y-20 md:space-y-28">
        {chapters.map((chapter, index) => (
          <StoryChapter
            key={chapter.key}
            chapterKey={chapter.key}
            preview={chapter.preview}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
