'use server';

import { revalidatePath } from 'next/cache';
import { readCollection, writeCollection, newId } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import type { Customer, Order } from '@/lib/types';
import type { ActionResult } from './orders';
import { logEvent } from '@/lib/events';

function parseCustomerForm(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  if (!name) return { error: 'The customer needs a name.' };
  if (!email.includes('@')) return { error: 'Enter a valid email.' };
  if (phone.replace(/\D/g, '').length < 10) return { error: 'Enter a valid phone number.' };
  return {
    fields: { name, email, phone, city, state, marketingOptIn: formData.get('marketingOptIn') === 'on' },
  };
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  await assertPermission('customers.create');
  const parsed = parseCustomerForm(formData);
  if ('error' in parsed) return { ok: false, message: parsed.error! };

  const customers = await readCollection<Customer[]>('customers');
  if (customers.some((c) => c.email.toLowerCase() === parsed.fields.email)) {
    return { ok: false, message: 'A customer with that email already exists.' };
  }

  const created = {
    id: newId('cust'),
    ...parsed.fields,
    joinedAt: new Date().toISOString(),
    ordersCount: 0,
    totalSpent: 0,
    lastOrderAt: null,
    hasSubscription: false,
  };
  customers.unshift(created);
  await writeCollection('customers', customers);
  await logEvent({
    type: 'customer',
    title: `New customer ${created.name}`,
    message: `${created.email} · ${created.city || 'city unknown'}`,
    href: `/customers/${created.id}`,
  });
  revalidatePath('/customers');
  return { ok: true, message: `${parsed.fields.name} added.` };
}

export async function updateCustomer(customerId: string, formData: FormData): Promise<ActionResult> {
  await assertPermission('customers.edit');
  const parsed = parseCustomerForm(formData);
  if ('error' in parsed) return { ok: false, message: parsed.error! };

  const customers = await readCollection<Customer[]>('customers');
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, message: 'Customer not found.' };
  if (customers.some((c) => c.email.toLowerCase() === parsed.fields.email && c.id !== customerId)) {
    return { ok: false, message: 'Another customer already uses that email.' };
  }

  Object.assign(customer, parsed.fields);
  await writeCollection('customers', customers);
  revalidatePath('/customers');
  revalidatePath(`/customers/${customerId}`);
  return { ok: true, message: 'Customer updated.' };
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  await assertPermission('customers.delete');
  const [customers, orders] = await Promise.all([
    readCollection<Customer[]>('customers'),
    readCollection<Order[]>('orders'),
  ]);
  const idx = customers.findIndex((c) => c.id === customerId);
  if (idx === -1) return { ok: false, message: 'Customer not found.' };

  const orderCount = orders.filter((o) => o.customerId === customerId).length;
  if (orderCount > 0) {
    return {
      ok: false,
      message: `${customers[idx].name} has ${orderCount} order${orderCount === 1 ? '' : 's'} on record — customers with order history can't be deleted.`,
    };
  }

  const [removed] = customers.splice(idx, 1);
  await writeCollection('customers', customers);
  revalidatePath('/customers');
  return { ok: true, message: `${removed.name} deleted.` };
}
