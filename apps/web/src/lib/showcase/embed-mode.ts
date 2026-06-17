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

export function useShowcaseEmbed(): boolean {
  const pathname = usePathname();
  const [showcase, setShowcase] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    setShowcase(new URLSearchParams(window.location.search).get('showcase') === '1');
  }, [pathname]);

  return showcase;
}

export function isEmbedPathname(pathname: string): boolean {
  return pathname.startsWith('/embed/demo');
}
