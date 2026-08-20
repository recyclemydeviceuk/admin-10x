import { getSessionUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { toCsv, csvResponse } from '@/lib/csv';
import { matchesDate } from '@/lib/list';
import type { Order } from '@/lib/types';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'orders.export')) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const payment = url.searchParams.get('payment');
  const channel = url.searchParams.get('channel');
  const date = url.searchParams.get('date') ?? undefined;
  const q = url.searchParams.get('q')?.toLowerCase();

  let orders = await readCollection<Order[]>('orders');
  if (status && status !== 'all') {
    orders =
      status === 'to_fulfil'
        ? orders.filter((o) => ['placed', 'confirmed', 'packed'].includes(o.status))
        : orders.filter((o) => o.status === status);
  }
  if (payment) orders = orders.filter((o) => o.paymentStatus === payment);
  if (channel) orders = orders.filter((o) => o.channel === channel);
  if (date) orders = orders.filter((o) => matchesDate(o.placedAt, date));
  if (q) {
    orders = orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q),
    );
  }

  const csv = toCsv(
    ['Reference', 'Placed at', 'Status', 'Customer', 'Email', 'Phone', 'City', 'State', 'Pincode', 'Items', 'Qty', 'Subtotal', 'Shipping', 'Discount', 'Coupon', 'Total', 'Payment method', 'Payment status', 'Courier', 'AWB', 'Type'],
    orders.map((o) => [
      o.reference,
      o.placedAt,
      o.status,
      o.customerName,
      o.customerEmail,
      o.address.phone,
      o.address.city,
      o.address.state,
      o.address.pincode,
      o.items.map((i) => `${i.name} (${i.packets})`).join('; '),
      o.items.reduce((s, i) => s + i.quantity, 0),
      o.subtotal,
      o.shipping,
      o.discount,
      o.couponCode ?? '',
      o.total,
      o.paymentMethod,
      o.paymentStatus,
      o.courier ?? '',
      o.trackingNumber ?? '',
      o.channel === 'subscription' ? 'subscription' : 'one-time',
    ]),
  );

  return csvResponse(`10x-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
