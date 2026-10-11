import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-vazirmatn',
  // Next's generated Latin metric fallback fights Arabic metrics and causes a reflow.
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: 'تخته کارها', template: '%s · تخته کارها' },
  description: 'مدیریت کارهای تیم',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh bg-neutral-50 font-sans text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
