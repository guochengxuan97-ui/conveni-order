import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth-session';

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.password !== undefined) {
    if ((body.password as string).length < 6) {
      return NextResponse.json({ error: '6文字以上のパスワードが必要です' }, { status: 400 });
    }
    const hash = await bcrypt.hash(body.password as string, 10);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${id}`;
  }

  if (body.role !== undefined) {
    if (!['owner', 'manager', 'staff'].includes(body.role as string)) {
      return NextResponse.json({ error: '無効な権限です' }, { status: 400 });
    }
    await sql`UPDATE users SET role = ${body.role as string} WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  const { id } = await params;

  if (id === session.id) {
    return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 });
  }

  await sql`DELETE FROM users WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
