'use client';
import { useState, useEffect, FormEvent } from 'react';
import { ROLE_LABELS, type UserRole } from '@/lib/auth';

interface User {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
}

const ROLES: UserRole[] = ['owner', 'manager', 'staff'];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' as UserRole });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editPassword, setEditPassword] = useState<{ id: string; value: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowAdd(false);
      setForm({ username: '', password: '', role: 'staff' });
      load();
    } else {
      const data = await res.json();
      setFormError(data.error || 'エラーが発生しました');
    }
    setSaving(false);
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`「${user.username}」を削除しますか？`)) return;
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    load();
  };

  const handleChangeRole = async (user: User, role: UserRole) => {
    await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    load();
  };

  const handleChangePassword = async (id: string, password: string) => {
    if (password.length < 6) {
      alert('6文字以上のパスワードを入力してください');
      return;
    }
    const res = await fetch(`/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setEditPassword(null);
      alert('パスワードを変更しました');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">スタッフアカウントの追加・管理</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          ユーザー追加
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">読み込み中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">ユーザーがいません</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ユーザー名</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">権限</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">登録日</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{user.username}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user, e.target.value as UserRole)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {user.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {editPassword?.id === user.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="password"
                              placeholder="新パスワード"
                              value={editPassword.value}
                              onChange={(e) =>
                                setEditPassword({ id: user.id, value: e.target.value })
                              }
                              className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
                              autoFocus
                            />
                            <button
                              onClick={() => handleChangePassword(user.id, editPassword.value)}
                              className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                            >
                              変更
                            </button>
                            <button
                              onClick={() => setEditPassword(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditPassword({ id: user.id, value: '' })}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            PW変更
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-4">ユーザー追加</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">ユーザー名</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  パスワード (6文字以上)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">権限</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              {formError && (
                <p className="text-red-600 text-xs bg-red-50 rounded px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? '追加中...' : '追加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
