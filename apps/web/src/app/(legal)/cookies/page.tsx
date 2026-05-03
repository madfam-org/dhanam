'use client';

import { useTranslation } from '@dhanam/shared';

import { LegalPageLayout } from '~/components/legal/legal-page-layout';

export default function CookiesPage() {
  const { t } = useTranslation('legal');

  const sections = [
    {
      title: t('cookiesSections.whatAreCookies'),
      content: t('cookiesSections.whatAreCookiesContent'),
    },
    {
      title: t('cookiesSections.cookiesWeUse'),
      content: '',
      subsections: [
        {
          title: t('cookiesSections.essential'),
          content: `${t('cookiesSections.essentialContent')} (${t('cookiesSections.essentialExamples')})`,
        },
        {
          title: t('cookiesSections.analytics'),
          content: `${t('cookiesSections.analyticsContent')} (${t('cookiesSections.analyticsExamples')})`,
        },
        {
          title: t('cookiesSections.preferences'),
          content: `${t('cookiesSections.preferencesContent')} (${t('cookiesSections.preferencesExamples')})`,
        },
      ],
    },
    {
      title: t('cookiesSections.consentMechanism'),
      content: t('cookiesSections.consentMechanismContent'),
    },
    { title: t('cookiesSections.thirdParty'), content: t('cookiesSections.thirdPartyContent') },
    { title: t('cookiesSections.managing'), content: t('cookiesSections.managingContent') },
    { title: t('cookiesSections.changes'), content: t('cookiesSections.changesContent') },
  ];

  return (
    <LegalPageLayout
      title={t('cookiesTitle')}
      subtitle={t('cookiesSubtitle')}
      intro={t('cookiesIntro')}
      sections={sections}
    />
  );
}
