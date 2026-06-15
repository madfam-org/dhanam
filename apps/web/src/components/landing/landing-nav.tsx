'use client';

import { useTranslation, type LandingLocale } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { Globe, Menu, X } from 'lucide-react';
import { useState } from 'react';

import { usePublicAppUrl } from '@/hooks/usePublicSurface';

interface LandingNavProps {
  locale: LandingLocale;
}

const LOCALES: LandingLocale[] = ['es', 'en', 'pt-BR'];

function localeLabel(locale: LandingLocale): string {
  if (locale === 'es') return 'ES';
  if (locale === 'en') return 'EN';
  return 'PT';
}

export function LandingNav({ locale }: LandingNavProps) {
  const { t } = useTranslation('landing');
  const appUrl = usePublicAppUrl();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="container mx-auto px-6 py-4 border-b" aria-label="Primary">
      <div className="flex items-center justify-between">
        <a href={`/${locale}`} className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" aria-hidden />
          <span className="text-2xl font-bold">Dhanam</span>
        </a>

        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm" role="navigation" aria-label="Language">
            {LOCALES.map((l) => (
              <a
                key={l}
                href={`/${l}`}
                hrefLang={l === 'pt-BR' ? 'pt-BR' : l}
                className={`px-2 py-1 rounded ${l === locale ? 'bg-primary/10 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                aria-current={l === locale ? 'true' : undefined}
              >
                {localeLabel(l)}
              </a>
            ))}
          </div>
          <a href={`${appUrl}/login`}>
            <Button variant="ghost">{t('nav.login')}</Button>
          </a>
          <a href={`${appUrl}/register`}>
            <Button>{t('nav.getStarted')}</Button>
          </a>
        </div>

        <button
          type="button"
          className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="landing-mobile-menu"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          id="landing-mobile-menu"
          className="md:hidden mt-4 pb-4 flex flex-col gap-3 border-t pt-4"
        >
          <div className="flex items-center gap-1 text-sm">
            {LOCALES.map((l) => (
              <a
                key={l}
                href={`/${l}`}
                className={`px-2 py-1 rounded ${l === locale ? 'bg-primary/10 font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {localeLabel(l)}
              </a>
            ))}
          </div>
          <a href={`${appUrl}/login`} className="w-full">
            <Button variant="ghost" className="w-full justify-start">
              {t('nav.login')}
            </Button>
          </a>
          <a href={`${appUrl}/register`} className="w-full">
            <Button className="w-full">{t('nav.getStarted')}</Button>
          </a>
        </div>
      )}
    </nav>
  );
}
