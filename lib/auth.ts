import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { roleHas } from './permissions';
import type { Role } from './types';
import { ADMIN_COOKIE, SERVER_API_URL } from './backend';

// =========================================================
// The browser stores only the backend-issued admin JWT in an HttpOnly cookie.
// Admin credentials exist only in server/.env and are verified by the API.
// =========================================================

const COOKIE = ADMIN_COOKIE;

export async function createSession(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 86400,
    path: '/',
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string;
  readNotificationIds: string[];
  preferences: {
    fontScale: number;
    density: 'comfortable' | 'compact';
    sidebarCollapsed: boolean;
    reduceMotion: boolean;
  };
};

/** Cached per request — every layout/page/action can call this freely. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const response = await fetch(`${SERVER_API_URL}/api/v1/admin/auth/me`, {
      headers: { Authorization: `Bearer ${raw}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
        readNotificationIds?: string[];
        preferences?: SessionUser['preferences'];
        role: { id: string; name: string };
        permissions: string[];
      };
    };
    const user = payload.user;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? '',
      readNotificationIds: user.readNotificationIds ?? [],
      preferences: user.preferences ?? { fontScale: 100, density: 'comfortable', sidebarCollapsed: false, reduceMotion: false },
      role: { id: user.role.id, name: user.role.name, description: '', permissions: user.permissions, system: true },
    };
  } catch {
    return null;
  }
});

/** Page guard — redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

export function can(user: SessionUser, permission: string) {
  return roleHas(user.role.permissions, permission);
}

/** Page guard — bounces to the dashboard when the role lacks the permission. */
export async function requirePermission(permission: string): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect('/?denied=' + encodeURIComponent(permission));
  return user;
}

/** Action guard — throws instead of redirecting (server actions). */
export async function assertPermission(permission: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('Not signed in.');
  if (!can(user, permission)) throw new Error(`Your role does not allow this (${permission}).`);
  return user;
}
