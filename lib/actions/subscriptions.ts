'use server';

import { revalidatePath } from 'next/cache';
import { readCollection, writeCollection, newId } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import type { Customer, Product, Subscription, SubscriptionStatus } from '@/lib/types';
import type { ActionResult } from './orders';
import { logEvent } from '@/lib/events';

export async function setSubscriptionStatus(
  subId: string,
  status: SubscriptionStatus,
): Promise<ActionResult> {
  await assertPermission(status === 'cancelled' ? 'subscriptions.cancel' : 'subscriptions.pause');
  const subs = await readCollection<Subscription[]>('subscriptions');
  const sub = subs.find((s) => s.id === subId);
  if (!sub) return { ok: false, message: 'Subscription not found.' };

  sub.status = status;
  if (status === 'active') {
    const next = new Date();
    next.setDate(next.getDate() + 28);
    sub.nextDelivery = next.toISOString();
  } else {
    sub.nextDelivery = null;
  }

  await writeCollection('subscriptions', subs);
  revalidatePath('/subscriptions');
  return {
    ok: true,
    message:
      status === 'active'
        ? `${sub.reference} resumed — next delivery in 4 weeks.`
        : `${sub.reference} ${status}.`,
  };
}

/** Manual subscription — set up over phone / WhatsApp by the team. */
export async function createSubscription(formData: FormData): Promise<ActionResult> {
  await assertPermission('subscriptions.create');

  const customerId = String(formData.get('customerId') ?? '');
  const price = Number(formData.get('price'));
  const nextDelivery = String(formData.get('nextDelivery') ?? '');
  if (!Number.isFinite(price) || price <= 0) return { ok: false, message: 'The cycle price must be a positive number.' };
  if (!nextDelivery) return { ok: false, message: 'Pick the first delivery date.' };

  const [subs, customers, products] = await Promise.all([
    readCollection<Subscription[]>('subscriptions'),
    readCollection<Customer[]>('customers'),
    readCollection<Product[]>('products'),
  ]);
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, message: 'Pick a customer.' };

  // Bind the plan to a real pack — without it nothing can be shipped when the
  // cycle comes round.
  const product = products.find((p) => p.status === 'active') ?? products[0];
  const tier = product?.tiers.find((t) => t.available) ?? product?.tiers[0];
  if (!product || !tier) return { ok: false, message: 'No product available to subscribe to.' };

  const refNo = Math.max(200, ...subs.map((s) => Number(s.reference.split('-').pop()) || 0)) + 1;
  subs.unshift({
    id: newId('sub'),
    reference: `10X-SUB-${refNo}`,
    customerId: customer.id,
    customerName: customer.name,
    productId: product.id,
    tierId: tier.id,
    quantity: 1,
    sku: `${product.slug.toUpperCase()}-${tier.packets}-SUB`,
    productName: `${product.name} — ${tier.name}`,
    packets: `${tier.packets} Stick Packets`,
    price,
    cadence: 'Every 4 weeks',
    status: 'active',
    startedAt: new Date().toISOString(),
    nextDelivery: new Date(nextDelivery).toISOString(),
    cyclesDelivered: 0,
  });
  customer.hasSubscription = true;

  await writeCollection('subscriptions', subs);
  await writeCollection('customers', customers);
  await logEvent({
    type: 'subscription',
    title: `New subscription for ${customer.name}`,
    message: `₹${price.toLocaleString('en-IN')} every 4 weeks · first delivery ${new Date(nextDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    href: '/subscriptions',
  });
  revalidatePath('/subscriptions');
  return { ok: true, message: `Subscription created for ${customer.name}.` };
}

/** Hard-delete a subscription record — cancelling is usually right. */
export async function deleteSubscription(subId: string): Promise<ActionResult> {
  await assertPermission('subscriptions.delete');
  const subs = await readCollection<Subscription[]>('subscriptions');
  const idx = subs.findIndex((s) => s.id === subId);
  if (idx === -1) return { ok: false, message: 'Subscription not found.' };
  const [removed] = subs.splice(idx, 1);
  await writeCollection('subscriptions', subs);
  revalidatePath('/subscriptions');
  return { ok: true, message: `${removed.reference} deleted.` };
}
