'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useMemo } from 'react';

interface DemoNavigationContextValue {
  isDemoMode: boolean;
  demoHref: (path: string) => string;
  stripDemoPrefix: (path: string) => string;
}

const DemoNavigationContext = createContext<DemoNavigationContextValue>({
  isDemoMode: false,
  demoHref: (path) => path,
  stripDemoPrefix: (path) => path,
});

export function DemoNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const value = useMemo(() => {
    const isDemoMode = pathname.startsWith('/demo');

    return {
      isDemoMode,
      demoHref: (path: string) => (isDemoMode ? `/demo${path}` : path),
      stripDemoPrefix: (path: string) =>
        path.startsWith('/demo') ? path.replace(/^\/demo/, '') || '/' : path,
    };
  }, [pathname]);

  return <DemoNavigationContext.Provider value={value}>{children}</DemoNavigationContext.Provider>;
}

export function useDemoNavigation() {
  return useContext(DemoNavigationContext);
}
