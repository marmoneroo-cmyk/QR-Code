import type { Metadata, Viewport } from 'next';
import {
  Playfair_Display,
  EB_Garamond,
  Inter,
  Frank_Ruhl_Libre,
  Heebo,
} from 'next/font/google';
import './globals.css';

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

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-frank-ruhl',
  display: 'swap',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500'],
  variable: '--font-heebo',
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
      className={`${playfair.variable} ${garamond.variable} ${inter.variable} ${frankRuhl.variable} ${heebo.variable}`}
    >
      <body className="bg-black text-white font-sans">{children}</body>
    </html>
  );
}
