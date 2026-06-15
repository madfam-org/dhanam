import { DM_Sans, Fraunces } from 'next/font/google';
import type { ReactNode } from 'react';

const landingDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-landing-display',
  display: 'swap',
});

const landingUi = DM_Sans({
  subsets: ['latin'],
  variable: '--font-landing-ui',
  display: 'swap',
});

interface LandingLayoutProps {
  children: ReactNode;
}

/** Landing-scoped typography via `next/font` (Phase G). */
export default function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <div className={`${landingDisplay.variable} ${landingUi.variable} landing-root`}>
      {children}
    </div>
  );
}
