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


export type DeliveryMode = 'free' | 'priced' | 'live';

export type DeliverySettings = {
  deliveryMode: DeliveryMode;
  flatShipping: number;
  freeShippingOver: number;
};

export async function saveDelivery(formData: FormData): Promise<ActionResult> {
  await assertPermission('settings.delivery');
  const raw = String(formData.get('deliveryMode'));
  const mode: DeliveryMode = raw === 'free' ? 'free' : raw === 'live' ? 'live' : 'priced';
  const body: Record<string, unknown> = { deliveryMode: mode };
  if (mode !== 'free') {
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

export type SubscriptionSettings = {
  subscriptionIntervalDays: number;
  autopayReminderEveryDays: number;
  autopayReminderMax: number;
};

export async function saveSubscriptionSettings(formData: FormData): Promise<ActionResult> {
  await assertPermission('settings.delivery');
  const body = {
    subscriptionIntervalDays: Number(formData.get('subscriptionIntervalDays')),
    autopayReminderEveryDays: Number(formData.get('autopayReminderEveryDays')),
    autopayReminderMax: Number(formData.get('autopayReminderMax')),
  };
  if (!Number.isInteger(body.subscriptionIntervalDays) || body.subscriptionIntervalDays < 7 || body.subscriptionIntervalDays > 90) {
    return { ok: false, message: 'Deliver every 7–90 days.' };
  }
  if (!Number.isInteger(body.autopayReminderEveryDays) || body.autopayReminderEveryDays < 0 || body.autopayReminderEveryDays > 30) {
    return { ok: false, message: 'Remind every 0–30 days (0 turns reminders off).' };
  }
  if (!Number.isInteger(body.autopayReminderMax) || body.autopayReminderMax < 0 || body.autopayReminderMax > 20) {
    return { ok: false, message: 'Send at most 0–20 reminders per plan.' };
  }
  return patch('/api/v1/admin/settings/subscriptions', body);
}

export type PickupLocation = { name: string; address: string; address2: string; city: string; state: string; pincode: string; phone: string };

export type StoreSettings = {
  name: string;
  supportEmail: string;
  supportPhone: string;
  codEnabled: boolean;
  /** The warehouse, as Shiprocket has it. Read-only here — edit it in Shiprocket. */
  pickup: PickupLocation | null;
  pickupNickname: string;
  shiprocketConfigured: boolean;
};

export async function saveStoreSettings(formData: FormData): Promise<ActionResult> {
  await assertPermission('settings.delivery');
  const s = (k: string) => String(formData.get(k) ?? '').trim();
  const body = {
    name: s('name'),
    supportEmail: s('supportEmail'),
    supportPhone: s('supportPhone'),
    codEnabled: formData.get('codEnabled') === 'on',
  };
  if (!body.name) return { ok: false, message: 'The store needs a name.' };
  if (!/^\S+@\S+\.\S+$/.test(body.supportEmail)) return { ok: false, message: 'Enter a valid support email.' };
  return patch('/api/v1/admin/settings/store', body);
}

export async function saveAutoShipments(enabled: boolean): Promise<ActionResult> {
  await assertPermission('settings.syncing');
  return patch('/api/v1/admin/settings/syncing', { autoShipments: enabled });
}

export async function saveAutoApproveReturns(enabled: boolean): Promise<ActionResult> {
  await assertPermission('settings.syncing');
  return patch('/api/v1/admin/settings/syncing', { autoApproveReturns: enabled });
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
