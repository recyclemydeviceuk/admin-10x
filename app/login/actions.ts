'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession } from '@/lib/auth';

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const apiUrl = (process.env.SERVER_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    return { error: 'The backend is unavailable. Start it and try again.' };
  }
  const payload = await response.json().catch(() => ({})) as { token?: string };
  if (!response.ok || !payload.token) {
    return { error: 'That email and password don’t match.' };
  }
  await createSession(payload.token);
  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
