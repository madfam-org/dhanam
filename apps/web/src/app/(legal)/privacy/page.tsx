'use client';

import { useTranslation } from '@dhanam/shared';

import { LegalPageLayout } from '~/components/legal/legal-page-layout';

export default function PrivacyPage() {
  const { t } = useTranslation('legal');

  const sections = [
    {
      title: t('privacySections.dataController'),
      content: t('privacySections.dataControllerContent'),
    },
    {
      title: t('privacySections.dataCollected'),
      content: t('privacySections.dataCollectedContent'),
    },
    { title: t('privacySections.purposes'), content: t('privacySections.purposesContent') },
    { title: t('privacySections.legalBasis'), content: t('privacySections.legalBasisContent') },
    { title: t('privacySections.arcoRights'), content: t('privacySections.arcoRightsContent') },
    {
      title: t('privacySections.dataTransfers'),
      content: t('privacySections.dataTransfersContent'),
    },
    { title: t('privacySections.retention'), content: t('privacySections.retentionContent') },
    { title: t('privacySections.security'), content: t('privacySections.securityContent') },
    { title: t('privacySections.cookies'), content: t('privacySections.cookiesContent') },
    { title: t('privacySections.changes'), content: t('privacySections.changesContent') },
    { title: t('privacySections.contact'), content: t('privacySections.contactContent') },
  ];

  return (
    <LegalPageLayout
      title={t('privacyTitle')}
      subtitle={t('privacySubtitle')}
      intro={t('privacyIntro')}
      sections={sections}
    />
  );
}
