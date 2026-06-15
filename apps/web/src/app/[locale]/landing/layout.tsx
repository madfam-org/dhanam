import type { ReactNode } from 'react';

interface LandingLayoutProps {
  children: ReactNode;
}

/** Passthrough layout — metadata lives on `page.tsx` via `generateMetadata`. */
export default function LandingLayout({ children }: LandingLayoutProps) {
  return children;
}
