import type { Metadata } from 'next';
import { Inter, Josefin_Sans } from 'next/font/google';
import './globals.scss';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { LoadingProvider } from '@/components/providers/LoadingProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const josefin = Josefin_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-josefin',
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'NetScope Trend',
  description: 'NetScope Trend - Xếp hạng chủ đề hot trên mạng xã hội',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} ${josefin.variable} font-inter antialiased`}>
        <ToastProvider>
          <LanguageProvider>
            <LoadingProvider>{children}</LoadingProvider>
          </LanguageProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
