'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import type { ActionResult } from './orders';

async function result(response: Response, fallback: string): Promise<ActionResult> {
  const body = await response.json().catch(() => ({})) as { ok?: boolean; message?: string };
  return { ok: response.ok && body.ok !== false, message: body.message ?? fallback };
}

export async function saveAdminProfile(formData: FormData): Promise<ActionResult> {
  await assertPermission('settings.view');
  const response = await backendFetch('/api/v1/admin/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: String(formData.get('name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim().toLowerCase(),
    }),
  });
  const out = await result(response, 'Profile saved.');
  if (out.ok) revalidatePath('/', 'layout');
  return out;
}


export async function saveSidebarCollapsed(collapsed: boolean): Promise<void> {
  await assertPermission('settings.view');
  await backendFetch('/api/v1/admin/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences: { sidebarCollapsed: collapsed } }),
  });
}

export async function uploadAdminPhoto(formData: FormData): Promise<ActionResult> {
  await assertPermission('settings.view');
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Choose a photo first.' };
  const outbound = new FormData();
  outbound.append('file', file, file.name);
  const response = await backendFetch('/api/v1/admin/profile/photo', { method: 'POST', body: outbound });
  const out = await result(response, 'Profile photo updated.');
  if (out.ok) revalidatePath('/', 'layout');
  return out;
}

export async function removeAdminPhoto(): Promise<ActionResult> {
  await assertPermission('settings.view');
  const response = await backendFetch('/api/v1/admin/profile/photo', { method: 'DELETE' });
  const out = await result(response, 'Profile photo removed.');
  if (out.ok) revalidatePath('/', 'layout');
  return out;
}

export async function runSyncNow(): Promise<ActionResult> {
  await assertPermission('settings.view');
  const response = await backendFetch('/api/v1/admin/settings/sync/run', { method: 'POST' });
  const out = await result(response, 'Sync finished.');
  revalidatePath('/settings');
  return out;
}

/**
 * Self-service password change. The server refuses this for the .env owner —
 * that password lives in the environment file, not in the database.
 */
export async function changeOwnPassword(formData: FormData): Promise<ActionResult> {
  const newPassword = String(formData.get('newPassword') ?? '');
  if (newPassword !== String(formData.get('confirmPassword') ?? '')) {
    return { ok: false, message: 'The new passwords do not match.' };
  }
  const response = await backendFetch('/api/v1/admin/profile/password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      currentPassword: String(formData.get('currentPassword') ?? ''),
      newPassword,
    }),
  });
  const body = await response.json().catch(() => ({})) as { message?: string };
  return { ok: response.ok, message: body.message ?? (response.ok ? 'Password changed.' : 'Could not change the password.') };
}
