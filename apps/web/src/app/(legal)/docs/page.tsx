'use client';

import { useTranslation } from '@dhanam/shared';
import { Button } from '@dhanam/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
  const { t } = useTranslation('legal');

  return (
    <div className="text-center py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToHome')}
      </Link>
      <h1 className="text-3xl font-bold mb-4">{t('docsTitle')}</h1>
      <p className="text-muted-foreground mb-8">{t('docsDescription')}</p>
      <Button asChild>
        <a
          href="https://api.dhan.am/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2"
        >
          {t('docsRedirect')}
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
