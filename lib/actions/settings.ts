'use server';

import { revalidatePath } from 'next/cache';
import { backendFetch } from '@/lib/backend';
import { assertPermission } from '@/lib/auth';
import type { ActionResult } from './orders';

// =========================================================
// Store rules — business settings, never credentials.
//
// Shipping fee, free-delivery threshold, COD, the subscription
// cadence and the warehouse address live in MongoDB because the
// checkout prices against them and returns ship back to them.
// Keys and secrets do NOT belong here: those are locked in
// server/.env, and no server action can write them.
// =========================================================

async function patch(path: string, body: unknown): Promise<ActionResult> {
  let response: Response;
  try {
    response = await backendFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: 'Can’t reach the backend — nothing was saved.' };
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: data.message ?? 'The backend refused that change.' };
  }
  revalidatePath('/settings');
  return { ok: true, message: 'Saved — the storefront picks this up within half a minute.' };
}


export type DeliverySettings = {
  deliveryMode: 'free' | 'priced';
  flatShipping: number;
  freeShippingOver: number;
};

export async function saveDelivery(formData: FormData): Promise<ActionResult> {
  await assertPermission('settings.delivery');
  const mode = String(formData.get('deliveryMode')) === 'free' ? 'free' : 'priced';
  const body: Record<string, unknown> = { deliveryMode: mode };
  if (mode === 'priced') {
    body.flatShipping = Number(formData.get('flatShipping'));
    body.freeShippingOver = Number(formData.get('freeShippingOver'));
    if (!Number.isFinite(body.flatShipping as number) || (body.flatShipping as number) < 0) {
      return { ok: false, message: 'The delivery fee must be 0 or more.' };
    }
    if (!Number.isFinite(body.freeShippingOver as number) || (body.freeShippingOver as number) < 0) {
      return { ok: false, message: 'The free-delivery threshold must be 0 or more.' };
    }
  }
  return patch('/api/v1/admin/settings/delivery', body);
}

export async function saveComingSoon(enabled: boolean): Promise<ActionResult> {
  await assertPermission('settings.maintenance');
  return patch('/api/v1/admin/settings/coming-soon', { enabled });
}

export type SignupRow = { id: string; email: string; at: string };

export async function listSignups(): Promise<{ total: number; signups: SignupRow[] }> {
  await assertPermission('settings.maintenance');
  const response = await backendFetch('/api/v1/admin/settings/signups');
  if (!response.ok) return { total: 0, signups: [] };
  const body = (await response.json().catch(() => ({}))) as { total?: number; signups?: SignupRow[] };
  return { total: body.total ?? 0, signups: body.signups ?? [] };
}
