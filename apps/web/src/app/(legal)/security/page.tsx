'use client';

import { useTranslation } from '@dhanam/shared';

import { LegalPageLayout } from '~/components/legal/legal-page-layout';

export default function SecurityPage() {
  const { t } = useTranslation('legal');

  const sections = [
    { title: t('securitySections.overview'), content: t('securitySections.overviewContent') },
    { title: t('securitySections.encryption'), content: t('securitySections.encryptionContent') },
    {
      title: t('securitySections.authentication'),
      content: t('securitySections.authenticationContent'),
    },
    {
      title: t('securitySections.infrastructure'),
      content: t('securitySections.infrastructureContent'),
    },
    { title: t('securitySections.monitoring'), content: t('securitySections.monitoringContent') },
    { title: t('securitySections.dataAccess'), content: t('securitySections.dataAccessContent') },
    {
      title: t('securitySections.responsibleDisclosure'),
      content: t('securitySections.responsibleDisclosureContent'),
      subsections: [
        { title: t('securitySections.responsibleDisclosureSteps.email'), content: '' },
        { title: t('securitySections.responsibleDisclosureSteps.include'), content: '' },
        { title: t('securitySections.responsibleDisclosureSteps.timeline'), content: '' },
        { title: t('securitySections.responsibleDisclosureSteps.scope'), content: '' },
      ],
    },
    { title: t('securitySections.compliance'), content: t('securitySections.complianceContent') },
  ];

  return (
    <LegalPageLayout
      title={t('securityTitle')}
      subtitle={t('securitySubtitle')}
      intro={t('securityIntro')}
      sections={sections}
    />
  );
}
