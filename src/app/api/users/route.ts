import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { ensureDb } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  await ensureDb();
  const result = await sql`SELECT id, username, role, created_at FROM users ORDER BY created_at`;
  return NextResponse.json({ users: result.rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  await ensureDb();
  const { username, password, role } = await req.json();

  if (!username || !password || !role) {
    return NextResponse.json({ error: '入力してください' }, { status: 400 });
  }
  if ((password as string).length < 6) {
    return NextResponse.json({ error: '6文字以上のパスワードが必要です' }, { status: 400 });
  }
  if (!['owner', 'manager', 'staff'].includes(role as string)) {
    return NextResponse.json({ error: '無効な権限です' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password as string, 10);

  try {
    await sql`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (${id}, ${username as string}, ${hash}, ${role as string}, ${new Date().toISOString()})
    `;
    return NextResponse.json({ user: { id, username, role } });
  } catch {
    return NextResponse.json({ error: 'ユーザー名が既に使用されています' }, { status: 409 });
  }
}
