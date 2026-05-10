import { cookies } from 'next/headers';
import { verifyToken } from './auth';
import { AUTH_COOKIE, type AuthUser } from './auth-shared';

export async function getSession(): Promise<AuthUser | null> {
  try {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}
