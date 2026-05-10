import { SignJWT, jwtVerify } from 'jose';
export type { UserRole, AuthUser } from './auth-shared';
export { AUTH_COOKIE, ROLE_LABELS } from './auth-shared';
import type { AuthUser } from './auth-shared';

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
    return { id, username, role: role as AuthUser['role'] };
  } catch {
    return null;
  }
}
