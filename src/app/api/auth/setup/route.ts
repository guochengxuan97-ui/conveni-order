import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { createToken, AUTH_COOKIE } from '@/lib/auth';
import { ensureDb } from '@/lib/db';

export async function GET() {
  await ensureDb();
  const result = await sql`SELECT COUNT(*) AS count FROM users`;
  const count = parseInt(String(result.rows[0].count), 10);
  return NextResponse.json({ needsSetup: count === 0 });
}

export async function POST(req: Request) {
  await ensureDb();

  const countResult = await sql`SELECT COUNT(*) AS count FROM users`;
  if (parseInt(String(countResult.rows[0].count), 10) > 0) {
    return NextResponse.json({ error: 'セットアップ済みです' }, { status: 400 });
  }

  const { username, password } = await req.json();
  if (!username || !password || (password as string).length < 6) {
    return NextResponse.json({ error: '6文字以上のパスワードを設定してください' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password as string, 10);
  await sql`
    INSERT INTO users (id, username, password_hash, role, created_at)
    VALUES (${id}, ${username as string}, ${hash}, 'owner', ${new Date().toISOString()})
  `;

  const user = { id, username: username as string, role: 'owner' as const };
  const token = await createToken(user);
  const response = NextResponse.json({ user });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  });
  return response;
}
