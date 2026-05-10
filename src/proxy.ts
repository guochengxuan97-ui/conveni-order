import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, AUTH_COOKIE } from '@/lib/auth';

const PUBLIC_PREFIXES = ['/login', '/api/auth/', '/api/migrate'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const user = await verifyToken(token);
  if (!user) {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete(AUTH_COOKIE);
    return res;
  }

  if (
    (pathname.startsWith('/users') || pathname.startsWith('/api/users')) &&
    user.role !== 'owner'
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (
    (pathname.startsWith('/settings') || pathname.startsWith('/api/settings')) &&
    user.role === 'staff'
  ) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon|manifest|sw\\.js|favicon\\.ico).*)'],
};
