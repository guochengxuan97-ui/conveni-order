import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'コンビニ発注最適化',
  description: 'コンビニデリ商品の発注最適化システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900">
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
