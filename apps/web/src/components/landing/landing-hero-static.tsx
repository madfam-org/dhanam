import { getLandingTranslation, type LandingLocale } from '@dhanam/shared';
import { Sparkles } from 'lucide-react';

const CAPABILITY_KEYS = ['defiNetworks', 'stressScenarios', 'collectibleCategories'] as const;

interface LandingHeroStaticProps {
  locale: LandingLocale;
}

export function LandingHeroStatic({ locale }: LandingHeroStaticProps) {
  const t = (key: string) => getLandingTranslation(locale, key);

  return (
    <div className="text-center space-y-6 max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 mb-4">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <span className="text-sm font-medium">{t('hero.badge')}</span>
      </div>

      <h1 id="landing-hero" className="text-4xl md:text-6xl font-bold tracking-tight">
        {t('hero.title')}
      </h1>

      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
        {t('hero.subtitle')}
      </p>

      <p className="text-sm text-muted-foreground max-w-xl mx-auto">{t('hero.subDescription')}</p>
    </div>
  );
}

export function LandingHeroCapabilities({ locale }: LandingHeroStaticProps) {
  const t = (key: string) => getLandingTranslation(locale, key);

  return (
    <div className="mt-12 flex flex-wrap gap-4 justify-center max-w-2xl mx-auto">
      {CAPABILITY_KEYS.map((key) => (
        <div
          key={key}
          className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium"
        >
          {t(`hero.capabilities.${key}`)}
        </div>
      ))}
    </div>
  );
}
