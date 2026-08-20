'use server';

import { createSession } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import type { ActionResult } from './orders';

// Face lock plumbing. The browser computes face descriptors locally (lib/face);
// these actions only ferry the numbers to the API — and on a successful
// sign-in, set the same session cookie a password login sets.

const API = (process.env.SERVER_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

type Json = Record<string, unknown>;

async function readJson(response: Response): Promise<Json> {
  return (await response.json().catch(() => ({}))) as Json;
}

export type FaceLockStatus = { enrolled: boolean; poses: number; updatedAt: string | null; lastUsedAt: string | null };

export async function faceLockStatus(): Promise<FaceLockStatus> {
  const response = await backendFetch('/api/v1/admin/auth/face');
  const body = await readJson(response);
  if (!response.ok) return { enrolled: false, poses: 0, updatedAt: null, lastUsedAt: null };
  return {
    enrolled: Boolean(body.enrolled),
    poses: Number(body.poses ?? 0),
    updatedAt: (body.updatedAt as string | null) ?? null,
    lastUsedAt: (body.lastUsedAt as string | null) ?? null,
  };
}

export async function enrollFaceLock(descriptors: number[][]): Promise<ActionResult> {
  const response = await backendFetch('/api/v1/admin/auth/face/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ descriptors }),
  });
  const body = await readJson(response);
  return { ok: response.ok, message: String(body.message ?? (response.ok ? 'Face lock set.' : 'Could not save the face lock.')) };
}

export async function removeFaceLock(): Promise<ActionResult> {
  const response = await backendFetch('/api/v1/admin/auth/face', { method: 'DELETE' });
  const body = await readJson(response);
  return { ok: response.ok, message: String(body.message ?? (response.ok ? 'Face lock removed.' : 'Could not remove the face lock.')) };
}

/** Public sign-in: email + live descriptor → session cookie on match. */
export async function faceLogin(email: string, descriptor: number[]): Promise<ActionResult> {
  let response: Response;
  try {
    response = await fetch(`${API}/api/v1/admin/auth/face/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, descriptor }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, message: 'The backend is unavailable. Start it and try again.' };
  }
  const body = await readJson(response);
  if (!response.ok || !body.token) {
    return { ok: false, message: String(body.message ?? 'Face not recognised. Use your email and password.') };
  }
  await createSession(String(body.token));
  return { ok: true, message: 'Signed in.' };
}
