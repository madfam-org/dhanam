'use client';

import { useTranslation } from '@dhanam/shared';
import { Globe } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  const { t } = useTranslation('landing');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="container mx-auto px-6 py-8 border-t">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <span className="font-semibold">Dhanam</span>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Dhanam. By{' '}
            <a
              href="https://madfam.io"
              className="text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Innovaciones MADFAM S.A.S. de C.V.
            </a>
            .
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <a href="https://madfam.io/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <span aria-hidden="true">&middot;</span>
            <a href="https://madfam.io/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </a>
            <span aria-hidden="true">&middot;</span>
            <a href="https://status.madfam.io" className="hover:text-foreground transition-colors">
              Status
            </a>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
            {t('footer.privacy')}
          </Link>
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
            {t('footer.terms')}
          </Link>
          <Link href="/security" className="text-sm text-muted-foreground hover:text-foreground">
            {t('footer.security')}
          </Link>
          <Link
            href="/esg-methodology"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('footer.esgMethodology')}
          </Link>
          <Link href="/status" className="text-sm text-muted-foreground hover:text-foreground">
            {t('footer.statusPage')}
          </Link>
          <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
            {t('footer.docs')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
