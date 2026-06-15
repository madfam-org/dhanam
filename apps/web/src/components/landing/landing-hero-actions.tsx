'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { ArrowRight } from 'lucide-react';

interface LandingHeroActionsProps {
  onLiveDemoClick: () => void;
  onSignUpClick: () => void;
}

export function LandingHeroActions({ onLiveDemoClick, onSignUpClick }: LandingHeroActionsProps) {
  const { t } = useTranslation('landing');

  return (
    <div className="text-center space-y-6 max-w-4xl mx-auto pt-2 lg:text-left">
      <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
        <Button size="lg" onClick={onLiveDemoClick} className="gap-2">
          {t('hero.cta')}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button size="lg" variant="outline" onClick={() => onSignUpClick()} className="gap-2">
          {t('hero.ctaSecondary')}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t('hero.demoNote')}</p>
    </div>
  );
}
