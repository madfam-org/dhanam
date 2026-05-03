'use client';

import { useTranslation } from '@dhanam/shared';

import { LegalPageLayout } from '~/components/legal/legal-page-layout';

export default function TermsPage() {
  const { t } = useTranslation('legal');

  const sections = [
    { title: t('termsSections.acceptance'), content: t('termsSections.acceptanceContent') },
    {
      title: t('termsSections.serviceDescription'),
      content: t('termsSections.serviceDescriptionContent'),
    },
    { title: t('termsSections.accounts'), content: t('termsSections.accountsContent') },
    { title: t('termsSections.subscriptions'), content: t('termsSections.subscriptionsContent') },
    {
      title: t('termsSections.financialDisclaimer'),
      content: t('termsSections.financialDisclaimerContent'),
    },
    {
      title: t('termsSections.intellectualProperty'),
      content: t('termsSections.intellectualPropertyContent'),
    },
    { title: t('termsSections.userConduct'), content: t('termsSections.userConductContent') },
    {
      title: t('termsSections.thirdPartyServices'),
      content: t('termsSections.thirdPartyServicesContent'),
    },
    { title: t('termsSections.liability'), content: t('termsSections.liabilityContent') },
    { title: t('termsSections.jurisdiction'), content: t('termsSections.jurisdictionContent') },
    { title: t('termsSections.termination'), content: t('termsSections.terminationContent') },
    { title: t('termsSections.changes'), content: t('termsSections.changesContent') },
  ];

  return (
    <LegalPageLayout
      title={t('termsTitle')}
      subtitle={t('termsSubtitle')}
      intro={t('termsIntro')}
      sections={sections}
    />
  );
}
