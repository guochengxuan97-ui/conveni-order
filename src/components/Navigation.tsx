'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type AuthUser, type UserRole, ROLE_LABELS } from '@/lib/auth-shared';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  minRole?: UserRole;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'ダッシュボード', icon: '📊' },
  { href: '/sales', label: '販売実績', icon: '📝' },
  { href: '/products', label: '商品管理', icon: '📦', minRole: 'manager' },
  { href: '/order', label: '発注試算', icon: '🧮', minRole: 'manager' },
  { href: '/ai-order', label: 'AI発注推奨', icon: '🤖', minRole: 'manager' },
  { href: '/reports', label: '売上レポート', icon: '📈', minRole: 'manager' },
  { href: '/settings', label: '設定', icon: '⚙️', minRole: 'owner' },
  { href: '/users', label: 'ユーザー管理', icon: '👥', minRole: 'owner' },
];

const ROLE_RANK: Record<UserRole, number> = { staff: 0, manager: 1, owner: 2 };

function canAccess(item: NavItem, role: UserRole | undefined): boolean {
  if (!role) return false;
  if (!item.minRole) return true;
  return ROLE_RANK[role] >= ROLE_RANK[item.minRole];
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUser(data.user))
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const visibleItems = NAV_ITEMS.filter((item) => canAccess(item, user?.role));

  if (pathname === '/login') return null;

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen p-4 shrink-0">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-emerald-700">🏪 コンビニ発注</h1>
          <p className="text-xs text-gray-400 mt-1">デリ商品最適化システム</p>
        </div>

        <div className="space-y-1 flex-1">
          {visibleItems.map((item) => (
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

        {user && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            <div className="px-3 py-2 text-xs text-gray-500">
              <div className="font-medium text-gray-700">{user.username}</div>
              <div className="text-gray-400">{ROLE_LABELS[user.role]}</div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <span className="text-base">🚪</span>
              ログアウト
            </button>
          </div>
        )}
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
        {visibleItems.slice(0, 5).map((item) => (
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
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center py-2 gap-0.5 text-gray-500 hover:text-gray-700"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] leading-tight">ログアウト</span>
        </button>
      </nav>
    </>
  );
}
