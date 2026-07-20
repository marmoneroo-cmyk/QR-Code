import type { Metadata, Viewport } from 'next';
import {
  Playfair_Display,
  EB_Garamond,
  Inter,
  Rubik,
} from 'next/font/google';
import './globals.css';
import { DirectionSync } from '@/components/DirectionSync';
import { MotionProvider } from '@/components/MotionProvider';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

const garamond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-garamond',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-inter',
  display: 'swap',
});

/**
 * Rubik is the single Hebrew face — it serves BOTH body and display, matching the
 * brand's other surfaces (site + customer emails). It replaced Heebo (body) and
 * Frank Ruhl Libre (display), so Hebrew headings are now sans rather than serif.
 * One family instead of two also means one less font payload on every Hebrew load.
 */
const rubik = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Interactive Cocktail Menu',
  description: 'A cinematic interactive 3D cocktail menu — explore every layer of every drink.',
  applicationName: 'Cocktail Menu',
  appleWebApp: {
    capable: true,
    title: 'Cocktails',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${garamond.variable} ${inter.variable} ${rubik.variable}`}
    >
      <body className="bg-black text-white font-sans">
        <DirectionSync />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
