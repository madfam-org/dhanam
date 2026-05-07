'use client';

import { I18nProvider, type Locale } from '@dhanam/shared';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

export default function LocaleLayout({ children }: { children: ReactNode }) {
  const { locale: localeParam } = useParams<{ locale: string }>();
  const locale = (['en', 'es', 'pt-BR'].includes(localeParam) ? localeParam : 'es') as Locale;

  return <I18nProvider defaultLocale={locale}>{children}</I18nProvider>;
}
