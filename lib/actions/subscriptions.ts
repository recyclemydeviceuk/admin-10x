'use server';

import { revalidatePath } from 'next/cache';
import { readCollection } from '@/lib/db';
import { backendFetch } from '@/lib/backend';
import { assertPermission } from '@/lib/auth';
import type { Product, SubscriptionStatus } from '@/lib/types';
import type { ActionResult } from './orders';

async function call(path: string, init: RequestInit): Promise<{ ok: boolean; message: string; data: Record<string, any> }> {
  let response: Response;
  try {
    response = await backendFetch(path, init);
  } catch {
    return { ok: false, message: 'Can’t reach the backend — nothing was changed.', data: {} };
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, any>;
  if (!response.ok) return { ok: false, message: data.error?.message ?? data.message ?? `Backend request failed (${response.status}).`, data };
  return { ok: true, message: data.message ?? 'Done.', data };
}

/**
 * Pause / resume / cancel through the server, which mirrors the change to
 * the Cashfree mandate, re-dates the next delivery from the plan's own
 * cadence, updates the customer's subscriber flag and emails them.
 */
export async function setSubscriptionStatus(
  subId: string,
  status: SubscriptionStatus,
): Promise<ActionResult> {
  await assertPermission(status === 'cancelled' ? 'subscriptions.cancel' : 'subscriptions.pause');
  const result = await call(`/api/v1/admin/subscriptions/${encodeURIComponent(subId)}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!result.ok) return result;
  revalidatePath('/subscriptions');
  revalidatePath('/customers');
  const sub = result.data.subscription as { reference?: string; nextDelivery?: string | null; intervalDays?: number } | undefined;
  return {
    ok: true,
    message:
      status === 'active'
        ? `${sub?.reference ?? 'Plan'} resumed — next delivery ${sub?.nextDelivery ? new Date(sub.nextDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'scheduled'}.`
        : `${sub?.reference ?? 'Plan'} ${status}.`,
  };
}

/** Manual subscription — set up over phone / WhatsApp by the team. */
export async function createSubscription(formData: FormData): Promise<ActionResult> {
  await assertPermission('subscriptions.create');

  const customerId = String(formData.get('customerId') ?? '');
  const packKey = String(formData.get('pack') ?? '');
  const price = Number(formData.get('price'));
  const quantity = Math.max(Number(formData.get('quantity')) || 1, 1);
  const nextDelivery = String(formData.get('nextDelivery') ?? '');
  if (!customerId) return { ok: false, message: 'Pick a customer.' };
  if (!packKey.includes(':')) return { ok: false, message: 'Pick a pack.' };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, message: 'The cycle price must be a positive number.' };
  if (!nextDelivery) return { ok: false, message: 'Pick the first delivery date.' };

  const [productId, tierId] = packKey.split(':');
  const products = await readCollection<Product[]>('products');
  const product = products.find((p) => p.id === productId);
  const tier = product?.tiers.find((t) => t.id === tierId);
  if (!product || !tier) return { ok: false, message: 'That pack is no longer in the catalogue.' };

  // Cadence comes from Settings → Subscriptions, the same as a storefront plan.
  const settings = await readCollection<{ store?: { subscriptionIntervalDays?: number } }>('settings');
  const intervalDays = settings?.store?.subscriptionIntervalDays ?? 28;

  const result = await call('/api/v1/admin/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      customerId,
      productId: product.id,
      tierId: tier.id,
      planName: `${product.name} — ${tier.name}`,
      quantity,
      price,
      intervalDays,
      nextDelivery: new Date(nextDelivery).toISOString(),
    }),
  });
  if (!result.ok) return result;
  revalidatePath('/subscriptions');
  revalidatePath('/customers');
  return { ok: true, message: `Subscription created — ${product.name} ${tier.name}, every ${intervalDays} days.` };
}

/** Hard-delete a subscription record — cancelling is usually right. */
export async function deleteSubscription(subId: string): Promise<ActionResult> {
  await assertPermission('subscriptions.delete');
  const result = await call(`/api/v1/admin/subscriptions/${encodeURIComponent(subId)}`, { method: 'DELETE' });
  if (!result.ok) return result;
  revalidatePath('/subscriptions');
  revalidatePath('/customers');
  return { ok: true, message: result.message };
}

/**
 * Email the customer the auto-pay set-up link right now. A mandate can only
 * be approved by the customer in their own bank/UPI app, so this is what
 * "set up auto-pay for them" means from the team's side. The backend refuses
 * if the customer has chosen pay on delivery.
 */
export async function sendAutopayReminder(subId: string): Promise<ActionResult> {
  await assertPermission('subscriptions.edit');
  let response: Response;
  try {
    response = await backendFetch(`/api/v1/admin/subscriptions/${encodeURIComponent(subId)}/autopay/remind`, { method: 'POST' });
  } catch {
    return { ok: false, message: 'Can’t reach the backend — nothing was sent.' };
  }
  const data = (await response.json().catch(() => ({}))) as { message?: string; reminders?: number };
  if (!response.ok) return { ok: false, message: data.message ?? 'The reminder was not sent.' };
  revalidatePath('/subscriptions');
  return { ok: true, message: `Auto-pay set-up email sent (reminder ${data.reminders ?? ''}).` };
}
