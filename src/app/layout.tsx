import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';
import PwaInit from '@/components/PwaInit';

export const metadata: Metadata = {
  title: 'コンビニ発注最適化',
  description: 'コンビニデリ商品の発注最適化システム',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '発注管理',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="theme-color" content="#16a34a" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-gray-50 text-gray-900">
        <PwaInit />
        <div className="flex min-h-screen">
          <Navigation />
          <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 min-w-0">
            <div className="max-w-4xl mx-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
