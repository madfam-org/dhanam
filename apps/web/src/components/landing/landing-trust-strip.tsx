import type { LandingLocale } from '@dhanam/shared/i18n/server';
import { getLandingTranslation } from '@dhanam/shared/i18n/server';
import { Lock, ShieldCheck, Sparkles } from 'lucide-react';

interface LandingTrustStripProps {
  locale: LandingLocale;
}

const ITEMS = [
  { key: 'trial' as const, icon: Sparkles },
  { key: 'encryption' as const, icon: Lock },
  { key: 'readOnly' as const, icon: ShieldCheck },
];

export function LandingTrustStrip({ locale }: LandingTrustStripProps) {
  const t = (key: string) => getLandingTranslation(locale, key);

  return (
    <ul className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start pt-4 text-sm text-muted-foreground">
      {ITEMS.map(({ key, icon: Icon }) => (
        <li key={key} className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <span>{t(`trustStrip.${key}`)}</span>
        </li>
      ))}
    </ul>
  );
}
