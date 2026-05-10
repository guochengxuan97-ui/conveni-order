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
