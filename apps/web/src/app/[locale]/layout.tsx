'use client';

import { I18nProvider, type Locale } from '@dhanam/shared';
import { useParams } from 'next/navigation';
import type { ReactNode as React18Node } from 'react';

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const locale = (['en', 'es', 'pt-BR'].includes(localeParam) ? localeParam : 'es') as Locale;

  return <I18nProvider defaultLocale={locale}>{children as React18Node}</I18nProvider>;
}
