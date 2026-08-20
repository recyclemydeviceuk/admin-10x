'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import type { ActionResult } from './orders';

async function result(response: Response, fallback: string): Promise<ActionResult & { tempPassword?: string }> {
  const body = await response.json().catch(() => ({})) as { message?: string; tempPassword?: string };
  // tempPassword only arrives when the invite email could not be sent — the
  // panel shows it once so the account isn't stranded.
  return { ok: response.ok, message: body.message ?? fallback, tempPassword: body.tempPassword };
}

export async function addTeamMember(formData: FormData): Promise<ActionResult & { tempPassword?: string }> {
  await assertPermission('team.invite');
  const response = await backendFetch('/api/v1/admin/team', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      roleId: String(formData.get('roleId') ?? ''),
    }),
  });
  const out = await result(response, 'Invite sent.');
  if (out.ok) revalidatePath('/team');
  return out;
}

export async function updateTeamMember(id: string, formData: FormData): Promise<ActionResult> {
  await assertPermission('team.roles');
  const response = await backendFetch(`/api/v1/admin/team/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      roleId: String(formData.get('roleId') ?? ''),
    }),
  });
  const out = await result(response, 'Team member updated.');
  if (out.ok) revalidatePath('/team');
  return out;
}

export async function resetTeamPassword(id: string): Promise<ActionResult & { tempPassword?: string }> {
  await assertPermission('team.password');
  return result(await backendFetch(`/api/v1/admin/team/${id}/password`, { method: 'POST' }), 'Password reset.');
}

export async function toggleTeamMember(id: string): Promise<ActionResult> {
  await assertPermission('team.deactivate');
  const out = await result(await backendFetch(`/api/v1/admin/team/${id}/toggle`, { method: 'POST' }), 'Account updated.');
  if (out.ok) revalidatePath('/team');
  return out;
}

export async function deleteTeamMember(id: string): Promise<ActionResult> {
  await assertPermission('team.delete');
  const out = await result(await backendFetch(`/api/v1/admin/team/${id}`, { method: 'DELETE' }), 'Team member deleted.');
  if (out.ok) revalidatePath('/team');
  return out;
}
