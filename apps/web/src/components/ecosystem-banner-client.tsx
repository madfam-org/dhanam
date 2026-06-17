'use client';

import { EcosystemBanner } from '@madfam/ecosystem-banner';
import { usePathname } from 'next/navigation';

import { isEmbedPathname } from '~/lib/showcase/embed-mode';

export function EcosystemBannerClient() {
  const pathname = usePathname();

  // Hero iframe and other embed surfaces must stay chromeless — no global ticker.
  if (isEmbedPathname(pathname)) {
    return null;
  }

  return <EcosystemBanner testId="ecosystem-banner" />;
}
