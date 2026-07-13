import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Providers } from './providers';
import './globals.css';

const TITLE = 'Argus — AI-powered security event analysis';
const DESCRIPTION =
  'Argus ingests a live stream of security events, detects threats, correlates them into incidents, and explains each one in plain language — on a real-time console.';

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
