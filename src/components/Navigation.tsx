'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: '📊' },
  { href: '/products', label: '商品管理', icon: '📦' },
  { href: '/sales', label: '販売実績', icon: '📝' },
  { href: '/order', label: '発注試算', icon: '🧮' },
  { href: '/ai-order', label: 'AI発注推奨', icon: '🤖' },
  { href: '/reports', label: '売上レポート', icon: '📈' },
  { href: '/settings', label: '設定', icon: '⚙️' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen p-4 shrink-0">
        <div className="mb-8">
          <h1 className="text-lg font-bold text-emerald-700">🏪 コンビニ発注</h1>
          <p className="text-xs text-gray-400 mt-1">デリ商品最適化システム</p>
        </div>
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 safe-area-inset-bottom">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors ${
              pathname === item.href ? 'text-emerald-700' : 'text-gray-500'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] leading-tight">{item.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
