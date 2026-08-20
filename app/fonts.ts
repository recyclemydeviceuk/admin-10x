import { Poppins, Quantico } from 'next/font/google';

// Poppins carries the whole panel UI — high x-height, very legible at small
// sizes. Quantico Bold Italic stays for the brand moments (logo-adjacent
// headings, big numbers) so the panel still reads as 10X.
export const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Arial', 'sans-serif'],
});

export const quantico = Quantico({
  variable: '--font-quantico',
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Arial', 'sans-serif'],
});
