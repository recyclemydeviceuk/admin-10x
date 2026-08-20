import type { Metadata, Viewport } from 'next';
import { poppins, quantico } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: '10X Admin', template: '%s — 10X Admin' },
  description: 'Operations panel for the 10X storefront.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${quantico.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
