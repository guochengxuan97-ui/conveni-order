import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { createToken, AUTH_COOKIE, type AuthUser } from '@/lib/auth';
import { ensureDb } from '@/lib/db';

export async function POST(req: Request) {
  await ensureDb();

  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: '入力してください' }, { status: 400 });
  }

  const result = await sql`
    SELECT id, username, password_hash, role FROM users WHERE username = ${username}
  `;
  const row = result.rows[0];
  if (!row) {
    return NextResponse.json({ error: 'ユーザー名またはパスワードが間違っています' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password as string, row.password_hash as string);
  if (!valid) {
    return NextResponse.json({ error: 'ユーザー名またはパスワードが間違っています' }, { status: 401 });
  }

  const user: AuthUser = {
    id: row.id as string,
    username: row.username as string,
    role: row.role as AuthUser['role'],
  };
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
