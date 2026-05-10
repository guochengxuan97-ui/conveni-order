import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export type UserRole = 'owner' | 'manager' | 'staff';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
}

export const AUTH_COOKIE = 'auth_token';

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'オーナー',
  manager: 'マネージャー',
  staff: 'スタッフ',
};

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ?? 'fallback-dev-secret-change-in-production-32c'
  );
}

export async function createToken(user: AuthUser): Promise<string> {
  return new SignJWT({ id: user.id, username: user.username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { id, username, role } = payload as Record<string, string>;
    if (!id || !username || !role) return null;
    return { id, username, role: role as UserRole };
  } catch {
    return null;
  }
}

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
