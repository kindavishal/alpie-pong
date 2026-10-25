import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { GeistMono } from 'geist/font/mono';
import { Inter } from 'next/font/google';
import { TAGLINE } from '@/lib/config/site';
import { CLIP_TOKENS } from '@/lib/render/tokens';
import { headlineSentences } from '@/lib/ui/stats';
import './globals.css';

/**
 * Type: Inter, the face 169Pi's own site uses, and Geist Mono for the numbers,
 * whose tabular digits the latency columns rely on. Both come through
 * next/font, so they are self-hosted with no layout shift. The headless clip
 * renderer and the social card still set their text in Geist (lib/render/assets.ts).
 *
 * Headings are set in Satoshi, 169Pi's display face, served by Fontshare's own
 * API. Its licence (ITF Free Font License) allows that and allows self-hosting
 * on our own servers, but not redistributing the files, so no Satoshi file is
 * kept in this repository. Until it loads, headings fall back to Inter.
 */
const SATOSHI_CSS = 'https://api.fontshare.com/v2/css?f[]=satoshi@500,700&display=swap';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

/**
 * Where this is served from. Without it the social card resolves against
 * localhost and the link posts without an image, which on the two places this
 * is aimed at — Hacker News and X — is most of the point. One env var
 * overrides it for a preview deployment.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${CLIP_TOKENS.copy.url}`;

/** The card's words are the page's words: the same headline, from the same run. */
const HEADLINE = headlineSentences();
const DESCRIPTION = `${HEADLINE.hero} ${HEADLINE.heroMs}. ${HEADLINE.chat} ${TAGLINE}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Alpie Pong',
  description: DESCRIPTION,
  applicationName: 'Alpie Pong',
  openGraph: { title: 'Alpie Pong', description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Alpie Pong', description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={SATOSHI_CSS} />
      </head>
      <body className="bg-bg text-fg flex min-h-full flex-col">
        {children}
        {/* Vercel Web Analytics: page views and the four events in lib/ui/analytics.ts. */}
        <Analytics />
      </body>
    </html>
  );
}
