'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const EMBED_COOKIE = 'embed-mode=true';

export function useEmbedMode(): boolean {
  const pathname = usePathname();
  const [cookieEmbed, setCookieEmbed] = useState(false);

  useEffect(() => {
    setCookieEmbed(typeof document !== 'undefined' && document.cookie.includes(EMBED_COOKIE));
  }, [pathname]);

  return pathname.startsWith('/embed/demo') || cookieEmbed;
}

export function isEmbedPathname(pathname: string): boolean {
  return pathname.startsWith('/embed/demo');
}
