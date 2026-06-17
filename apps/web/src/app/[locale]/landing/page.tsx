import {
  getLandingTranslation,
  LANDING_LOCALES,
  normalizeLandingLocale,
  type LandingLocale,
} from '@dhanam/shared/i18n/server';
import type { Metadata } from 'next';

import { HeroIpadExperience } from '@/components/landing/hero-ipad/hero-ipad-experience';
import {
  LandingHeroCapabilities,
  LandingHeroStatic,
} from '@/components/landing/landing-hero-static';
import { LandingPageClient } from '@/components/landing/landing-page-client';
import { LandingTrustStrip } from '@/components/landing/landing-trust-strip';

const OG_LOCALE: Record<LandingLocale, string> = {
  es: 'es_MX',
  en: 'en_US',
  'pt-BR': 'pt_BR',
};

export function generateStaticParams() {
  return LANDING_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale = normalizeLandingLocale(raw);
  const title = getLandingTranslation(locale, 'meta.title');
  const description = getLandingTranslation(locale, 'meta.description');
  const canonical = `https://dhan.am/${locale}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        es: 'https://dhan.am/es',
        en: 'https://dhan.am/en',
        'pt-BR': 'https://dhan.am/pt-BR',
        'x-default': 'https://dhan.am/es',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Dhanam',
      title,
      description,
      url: canonical,
      locale: OG_LOCALE[locale],
      alternateLocale: Object.values(OG_LOCALE).filter((l) => l !== OG_LOCALE[locale]),
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  };
}

export default async function LocaleLandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = normalizeLandingLocale(raw);

  const heroColumn = (
    <>
      <LandingHeroStatic locale={locale} />
      <LandingTrustStrip locale={locale} />
    </>
  );

  return (
    <LandingPageClient
      locale={locale}
      heroColumn={heroColumn}
      heroPreview={<HeroIpadExperience locale={locale} />}
      heroCapabilities={<LandingHeroCapabilities locale={locale} />}
    />
  );
}
