'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

interface DemoNavigationContextValue {
  isDemoMode: boolean;
  isEmbedMode: boolean;
  demoHref: (path: string) => string;
  stripDemoPrefix: (path: string) => string;
}

const DemoNavigationContext = createContext<DemoNavigationContextValue>({
  isDemoMode: false,
  isEmbedMode: false,
  demoHref: (path) => path,
  stripDemoPrefix: (path) => path,
});

export function DemoNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const value = useMemo(() => {
    const isEmbedMode = pathname.startsWith('/embed/demo');
    const isDemoMode = pathname.startsWith('/demo') || isEmbedMode;
    const prefix = isEmbedMode ? '/embed/demo' : isDemoMode ? '/demo' : '';

    return {
      isDemoMode,
      isEmbedMode,
      demoHref: (path: string) => {
        const normalized = path.startsWith('/') ? path : `/${path}`;
        return prefix ? `${prefix}${normalized}` : normalized;
      },
      stripDemoPrefix: (path: string) => {
        if (path.startsWith('/embed/demo')) {
          return path.replace(/^\/embed\/demo/, '') || '/';
        }
        if (path.startsWith('/demo')) {
          return path.replace(/^\/demo/, '') || '/';
        }
        return path;
      },
    };
  }, [pathname]);

  return <DemoNavigationContext.Provider value={value}>{children}</DemoNavigationContext.Provider>;
}

export function useDemoNavigation() {
  return useContext(DemoNavigationContext);
}
