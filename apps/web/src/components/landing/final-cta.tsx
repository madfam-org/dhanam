'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { ArrowRight } from 'lucide-react';

interface FinalCtaProps {
  onLiveDemoClick: () => void;
  onSignUpClick: () => void;
}

export function FinalCta({ onLiveDemoClick, onSignUpClick }: FinalCtaProps) {
  const { t } = useTranslation('landing');

  return (
    <section className="container mx-auto px-6 py-16">
      <div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-2xl p-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('cta.title')}</h2>
        <p className="text-lg text-muted-foreground mb-8">{t('cta.subtitle')}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => onSignUpClick()}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
          >
            {t('cta.button')}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={onLiveDemoClick}>
            {t('cta.buttonSecondary')}
          </Button>
        </div>
      </div>
    </section>
  );
}
