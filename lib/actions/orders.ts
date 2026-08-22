'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readCollection } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import type { Customer, OrderStatus, Product } from '@/lib/types';

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

function touch(path: string) {
  revalidatePath('/orders');
  revalidatePath(path);
  revalidatePath('/');
}

/* -------------------------------------------------------------- status */

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  await assertPermission('orders.status');
  // The server owns the lifecycle: timeline stamps, stock release, the
  // Shiprocket cancel, the automatic refund and the customer email all
  // happen there. Writing the status straight to the database skips them.
  const response = await backendFetch(`/api/v1/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
  if (!response.ok) return { ok: false, message: data.error?.message ?? data.message ?? `Backend request failed (${response.status}).` };
  touch(`/orders/${orderId}`);
  revalidatePath('/transactions');
  return {
    ok: true,
    message:
      status === 'cancelled'
        ? 'Order cancelled — stock is back on the shelf, any courier booking is stopped, and a paid order is being refunded.'
        : `Order marked ${status.replace(/_/g, ' ')}.`,
  };
}

/* --------------------------------------------------------------- notes */

export async function addOrderNote(orderId: string, text: string): Promise<ActionResult> {
  await assertPermission('orders.notes');
  const clean = text.trim();
  if (!clean) return { ok: false, message: 'Write a note first.' };
  const result = await backendMutation(`/api/v1/admin/orders/${orderId}/notes`, { text: clean });
  if (!result.ok) return result;
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
  return { ok: true, message: 'Shipment booked — courier assigned and pickup requested.' };
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
  await assertPermission('orders.create');

  const customerId = String(formData.get('customerId') ?? '');
  const quantity = Math.max(Number(formData.get('quantity')) || 1, 1);
  const tierKey = String(formData.get('tierId') ?? '');
  const paymentMethod = formData.get('paymentMethod') === 'online' ? 'online' : ('cod' as const);
  const note = String(formData.get('note') ?? '').trim();

  const [customers, products] = await Promise.all([
    readCollection<Customer[]>('customers'),
    readCollection<Product[]>('products'),
  ]);
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, message: 'Pick a customer (add them in Customers first).' };

  // The pack selector carries "<productId>:<tierId>" so every product's packs
  // are orderable, not just the first product's.
  const [productId, tierId] = tierKey.includes(':') ? tierKey.split(':') : [products[0]?.id ?? '', tierKey];
  const product = products.find((p) => p.id === productId);
  const tier = product?.tiers.find((t) => t.id === tierId);
  if (!product || !tier) return { ok: false, message: 'Pick a pack.' };

  const address = {
    fullName: String(formData.get('fullName') ?? '').trim() || customer.name,
    phone: String(formData.get('phone') ?? '').trim() || customer.phone,
    line1: String(formData.get('house') ?? '').trim(),
    line2: String(formData.get('street') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim() || customer.city,
    state: String(formData.get('state') ?? '').trim() || customer.state,
    pincode: String(formData.get('pincode') ?? '').trim(),
  };
  if (!address.line1 || !address.line2 || !address.pincode) {
    return { ok: false, message: 'Fill the full shipping address (house, street, pincode).' };
  }

  // The server prices delivery from the store settings, reserves stock,
  // numbers the order and confirms a cash order — the same path as checkout.
  const result = await backendMutation('/api/v1/admin/orders', {
    customerId,
    items: [{ productId: product.id, tierId: tier.id, name: product.name, tierName: tier.name, quantity, unitPrice: tier.oneTimePrice }],
    paymentMethod,
    address,
    note,
  });
  if (!result.ok) return result;
  const id = String(result.data?.order?._id ?? result.data?.order?.id ?? '');
  revalidatePath('/orders');
  revalidatePath('/');
  redirect(id ? `/orders/${id}` : '/orders');
}

/** Hard-delete an order — for test/duplicate entries. Cancelling is usually right. */
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  await assertPermission('orders.delete');
  // Through the server so a courier booking is stopped and reserved stock
  // returns before the record goes.
  const response = await backendFetch(`/api/v1/admin/orders/${orderId}`, { method: 'DELETE' });
  const data = (await response.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
  if (!response.ok) return { ok: false, message: data.error?.message ?? data.message ?? `Backend request failed (${response.status}).` };
  revalidatePath('/orders');
  revalidatePath('/');
  return { ok: true, message: data.message ?? 'Order deleted permanently.' };
}
