import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

// IBM Plex, the type family IBM designed for its own products: Sans for
// interface text, Mono for data. next/font self-hosts the files at
// build time, so the CSP's font-src 'self' holds.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const TITLE = 'Argus: security event analysis';
const DESCRIPTION =
  'Argus streams security logs, detects attacks with rules mapped to MITRE ATT&CK, groups alerts into incidents and explains each one in plain language.';

export const metadata: Metadata = {
  // resolves relative OG/twitter image paths to absolute URLs — set
  // NEXT_PUBLIC_SITE_URL to the real domain once deployed; degrades to
  // localhost in dev, same "optional, zero required config" pattern as
  // GOOGLE_CLIENT_ID/SLACK_WEBHOOK_URL elsewhere in this project.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: '/favicon.png' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Argus',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} dark`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
