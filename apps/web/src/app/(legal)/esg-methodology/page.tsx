'use client';

import { useTranslation } from '@dhanam/shared';

import { LegalPageLayout } from '~/components/legal/legal-page-layout';

export default function EsgMethodologyPage() {
  const { t } = useTranslation('legal');

  const sections = [
    { title: t('esgSections.overview'), content: t('esgSections.overviewContent') },
    { title: t('esgSections.sources'), content: t('esgSections.sourcesContent') },
    { title: t('esgSections.environmental'), content: t('esgSections.environmentalContent') },
    { title: t('esgSections.social'), content: t('esgSections.socialContent') },
    { title: t('esgSections.governance'), content: t('esgSections.governanceContent') },
    { title: t('esgSections.composite'), content: t('esgSections.compositeContent') },
    { title: t('esgSections.limitations'), content: t('esgSections.limitationsContent') },
    { title: t('esgSections.updates'), content: t('esgSections.updatesContent') },
  ];

  return (
    <LegalPageLayout
      title={t('esgTitle')}
      subtitle={t('esgSubtitle')}
      intro={t('esgIntro')}
      sections={sections}
    />
  );
}
