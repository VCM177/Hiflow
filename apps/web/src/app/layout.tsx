import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { siteUrl } from '@/server/site-url';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

// Vietnamese subset so every Vietnamese diacritic is served from the font, not a fallback.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
});

const base = siteUrl();

export const metadata: Metadata = {
  ...(base ? { metadataBase: new URL(base) } : {}),
  title: 'Hiflow',
  description: 'Hệ thống quản lý tuyển dụng Hiflow',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
