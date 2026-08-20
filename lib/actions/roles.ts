'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import type { ActionResult } from './orders';

async function send(path: string, method: string, body?: unknown): Promise<ActionResult> {
  const response = await backendFetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as { message?: string };
  const out = { ok: response.ok, message: payload.message ?? (response.ok ? 'Saved.' : 'Could not save.') };
  if (out.ok) revalidatePath('/roles');
  return out;
}

export async function createRole(input: { name: string; description: string; permissions: string[] }): Promise<ActionResult> {
  await assertPermission('roles.create');
  return send('/api/v1/admin/roles', 'POST', input);
}

export async function updateRole(id: string, input: { name: string; description: string; permissions: string[] }): Promise<ActionResult> {
  await assertPermission('roles.edit');
  return send(`/api/v1/admin/roles/${id}`, 'PATCH', input);
}

export async function deleteRole(id: string): Promise<ActionResult> {
  await assertPermission('roles.delete');
  return send(`/api/v1/admin/roles/${id}`, 'DELETE');
}
