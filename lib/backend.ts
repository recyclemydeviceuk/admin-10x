import 'server-only';
import { cookies } from 'next/headers';

export const SERVER_API_URL = (process.env.SERVER_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const ADMIN_COOKIE = '10x_admin_session';

export async function adminToken(): Promise<string> {
  return (await cookies()).get(ADMIN_COOKIE)?.value ?? '';
}

export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await adminToken();
  return fetch(`${SERVER_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
}
