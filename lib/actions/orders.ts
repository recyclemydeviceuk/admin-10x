'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readCollection, writeCollection, newId } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import {
  ORDER_STAGES,
  type Customer,
  type Order,
  type OrderStatus,
  type Product,
} from '@/lib/types';
import { logEvent } from '@/lib/events';

export type ActionResult = { ok: boolean; message: string };

async function backendMutation(
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; message: string; data?: Record<string, any> }> {
  const response = await backendFetch(path, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    return { ok: false, message: data.error?.message ?? data.message ?? `Backend request failed (${response.status}).` };
  }
  return { ok: true, message: data.message ?? 'Done.', data };
}

async function loadOrder(orderId: string) {
  const orders = await readCollection<Order[]>('orders');
  const order = orders.find((o) => o.id === orderId);
  if (!order) throw new Error('Order not found.');
  return { orders, order };
}

function touch(path: string) {
  revalidatePath('/orders');
  revalidatePath(path);
  revalidatePath('/');
}

/* -------------------------------------------------------------- status */

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  const user = await assertPermission('orders.status');
  const { orders, order } = await loadOrder(orderId);

  order.status = status;
  const now = new Date().toISOString();

  // Keep the customer-facing timeline honest: stamp every stage up to the new
  // one, clear stages beyond it.
  const reachedIdx = ORDER_STAGES.indexOf(status as (typeof ORDER_STAGES)[number]);
  if (reachedIdx >= 0) {
    order.timeline = ORDER_STAGES.map((stage, i) => {
      const existing = order.timeline.find((e) => e.stage === stage);
      if (i < reachedIdx) return existing?.at ? existing : { stage, at: now };
      if (i === reachedIdx) return { stage, at: now };
      return { stage, at: null };
    });
  }
  if (status === 'cancelled' && order.paymentMethod === 'cod') order.paymentStatus = 'failed';

  order.notes = order.notes ?? [];
  order.notes.push({ by: user.name, at: now, text: `Status set to ${status}.` });

  await writeCollection('orders', orders);
  touch(`/orders/${orderId}`);
  return { ok: true, message: `Order marked ${status.replace(/_/g, ' ')}.` };
}

/* --------------------------------------------------------------- notes */

export async function addOrderNote(orderId: string, text: string): Promise<ActionResult> {
  const user = await assertPermission('orders.notes');
  const clean = text.trim();
  if (!clean) return { ok: false, message: 'Write a note first.' };

  const { orders, order } = await loadOrder(orderId);
  order.notes = order.notes ?? [];
  order.notes.push({ by: user.name, at: new Date().toISOString(), text: clean });
  await writeCollection('orders', orders);
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Note added.' };
}

/* -------------------------------------------------------------- refund */

export async function refundOrder(orderId: string, note: string): Promise<ActionResult> {
  await assertPermission('orders.refund');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/refund`, { note });
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Refund recorded.' };
}

/* ---------------------------------------------------------- fulfilment */

export async function createShipment(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.create');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/shipment`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Shipment created. Assign the AWB when ready.' };
}

/** Retry AWB assignment for an existing shipment. */
export async function assignAwbAction(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.awb');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/awb`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'AWB assigned.' };
}

/** Ask Shiprocket to schedule the courier pickup. */
export async function requestPickupAction(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.pickup');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/pickup`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Pickup requested.' };
}

/** Generate (and store the link to) the shipping label PDF. */
export async function generateLabelAction(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.label');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/label`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Label ready — the download link is in the Shipment card.' };
}

/** Generate (and store the link to) the tax invoice PDF. */
export async function generateInvoiceAction(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.invoice');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/shiprocket-invoice`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Invoice ready — the download link is in the Shipment card.' };
}

/** Pull live tracking from Shiprocket and sync the order status. */
export async function syncTrackingAction(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.track');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/track`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: `Shiprocket says: ${result.data?.courierStatus ?? 'tracking updated'}.` };
}

/** Cancel the Shiprocket shipment (before pickup). */
export async function cancelShipmentAction(orderId: string): Promise<ActionResult> {
  await assertPermission('fulfilment.cancel');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/cancel-shipment`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: 'Shipment cancelled. You can create a fresh one when ready.' };
}

/** Manual fulfilment — enter courier + AWB by hand (no API involved). */
export async function setManualTracking(
  orderId: string,
  courier: string,
  awb: string,
): Promise<ActionResult> {
  await assertPermission('fulfilment.manual');
  const cleanCourier = courier.trim();
  const cleanAwb = awb.trim();
  if (!cleanCourier || !cleanAwb) return { ok: false, message: 'Enter both the courier name and the AWB / tracking number.' };

  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/manual-tracking`, {
    courier: cleanCourier,
    awb: cleanAwb,
  });
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  return { ok: true, message: `Tracking saved — ${cleanCourier}, ${cleanAwb}.` };
}

/* ------------------------------------------------------------ payments */

/** Pull the live payment status for one order from the Cashfree API. */
export async function syncPaymentStatus(orderId: string): Promise<ActionResult> {
  await assertPermission('transactions.sync');
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/sync-payment`);
  if (!result.ok) return result;
  touch(`/orders/${orderId}`);
  revalidatePath('/transactions');
  return { ok: true, message: `Cashfree status: ${result.data?.gatewayStatus ?? 'updated'}.` };
}

/* ------------------------------------------------------ create / delete */

/** Manual order — phone / WhatsApp / exchange orders entered by the team. */
export async function createManualOrder(formData: FormData): Promise<never | ActionResult> {
  const user = await assertPermission('orders.create');

  const customerId = String(formData.get('customerId') ?? '');
  const quantity = Math.max(Number(formData.get('quantity')) || 1, 1);
  const tierId = String(formData.get('tierId') ?? '10-pack');
  const paymentMethod = formData.get('paymentMethod') === 'online' ? 'online' : ('cod' as const);
  const note = String(formData.get('note') ?? '').trim();

  const [orders, customers, products] = await Promise.all([
    readCollection<Order[]>('orders'),
    readCollection<Customer[]>('customers'),
    readCollection<Product[]>('products'),
  ]);

  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, message: 'Pick a customer (add them in Customers first).' };
  const product = products[0];
  const tier = product?.tiers.find((t) => t.id === tierId) ?? product?.tiers[0];
  if (!product || !tier) return { ok: false, message: 'No product available to order.' };

  const address = {
    fullName: String(formData.get('fullName') ?? customer.name).trim() || customer.name,
    phone: String(formData.get('phone') ?? customer.phone).trim() || customer.phone,
    house: String(formData.get('house') ?? '').trim(),
    street: String(formData.get('street') ?? '').trim(),
    city: String(formData.get('city') ?? customer.city).trim() || customer.city,
    state: String(formData.get('state') ?? customer.state).trim() || customer.state,
    pincode: String(formData.get('pincode') ?? '').trim(),
  };
  if (!address.house || !address.street || !address.pincode) {
    return { ok: false, message: 'Fill the full shipping address (house, street, pincode).' };
  }

  const subtotal = tier.oneTimePrice * quantity;
  const shipping = subtotal >= 999 ? 0 : 79;
  const now = new Date().toISOString();
  const refNo = Math.max(1200, ...orders.map((o) => Number(o.reference.split('-')[1]) || 0)) + 1;

  const order: Order = {
    id: newId('ord'),
    reference: `10X-${refNo}`,
    placedAt: now,
    status: 'placed',
    customerId: customer.id,
    customerName: customer.name,
    customerEmail: customer.email,
    items: [
      {
        sku: `10X-DT-${tier.packets}`,
        name: product.name,
        packets: `${tier.packets} packets`,
        quantity,
        price: tier.oneTimePrice,
        productId: product.id,
        tierId: tier.id,
        tierName: tier.name,
      },
    ],
    subtotal,
    shipping,
    discount: 0,
    total: subtotal + shipping,
    paymentMethod,
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
    payment: paymentMethod === 'cod' ? { provider: 'cod' } : { provider: 'cashfree' },
    address,
    timeline: ORDER_STAGES.map((stage, i) => ({ stage, at: i === 0 ? now : null })),
    channel: 'website',
    notes: [{ by: user.name, at: now, text: `Manual order created${note ? ` — ${note}` : ''}.` }],
  };

  orders.unshift(order);
  await logEvent({
    type: 'order',
    title: `New order ${order.reference}`,
    message: `${customer.name} · ${quantity} × ${tier.name} · ₹${order.total.toLocaleString('en-IN')} (${paymentMethod.toUpperCase()})`,
    href: `/orders/${order.id}`,
  });
  customer.ordersCount++;
  customer.totalSpent += order.total;
  customer.lastOrderAt = now;

  await writeCollection('orders', orders);
  await writeCollection('customers', customers);
  revalidatePath('/orders');
  revalidatePath('/');
  redirect(`/orders/${order.id}`);
}

/** Hard-delete an order — for test/duplicate entries. Cancelling is usually right. */
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  await assertPermission('orders.delete');
  const orders = await readCollection<Order[]>('orders');
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) return { ok: false, message: 'Order not found.' };
  const [removed] = orders.splice(idx, 1);
  await writeCollection('orders', orders);
  revalidatePath('/orders');
  revalidatePath('/');
  return { ok: true, message: `${removed.reference} deleted permanently.` };
}
