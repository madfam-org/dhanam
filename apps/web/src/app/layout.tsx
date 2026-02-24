import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { Providers } from '~/lib/providers';
import { Toaster } from 'sonner';
import '~/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: 'Dhanam - Budget & Wealth Tracker',
  description:
    'Comprehensive financial management for personal and business. Track budgets, wealth, DeFi portfolios, and ESG scores — all in one place.',
  metadataBase: new URL('https://dhan.am'),
  alternates: {
    canonical: 'https://dhan.am',
    languages: {
      es: 'https://dhan.am/es',
      en: 'https://dhan.am/en',
      'pt-BR': 'https://dhan.am/pt-BR',
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'Dhanam',
    title: 'Dhanam - Budget & Wealth Tracker',
    description:
      'Track budgets, wealth, DeFi portfolios, and ESG scores — personal and business finance in one place.',
    url: 'https://dhan.am',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Dhanam - Budget & Wealth Tracker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dhanam - Budget & Wealth Tracker',
    description:
      'Track budgets, wealth, DeFi portfolios, and ESG scores — personal and business finance in one place.',
    images: ['/og-image.png'],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('dhanam_locale')?.value || 'es';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Dhanam',
    url: 'https://dhan.am',
    logo: 'https://dhan.am/logo.png',
    description:
      'Comprehensive financial management for personal and business with ESG crypto insights.',
    sameAs: ['https://github.com/madfam-org/dhanam'],
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="alternate" hrefLang="es" href="https://dhan.am/es" />
        <link rel="alternate" hrefLang="en" href="https://dhan.am/en" />
        <link rel="alternate" hrefLang="pt-BR" href="https://dhan.am/pt-BR" />
        <link rel="alternate" hrefLang="x-default" href="https://dhan.am" />
        <meta
          property="og:locale"
          content={locale === 'en' ? 'en_US' : locale === 'pt-BR' ? 'pt_BR' : 'es_MX'}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
