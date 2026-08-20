import { getSessionUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { toCsv, csvResponse } from '@/lib/csv';
import { matchesDate } from '@/lib/list';
import type { Order } from '@/lib/types';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'transactions.export')) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const method = url.searchParams.get('method');
  const date = url.searchParams.get('date') ?? undefined;
  const q = url.searchParams.get('q')?.toLowerCase();

  let orders = await readCollection<Order[]>('orders');
  if (status) orders = orders.filter((o) => o.paymentStatus === status);
  if (method) {
    orders = orders.filter((o) =>
      method === 'cashfree' ? o.payment?.provider === 'cashfree' : o.payment?.provider !== 'cashfree',
    );
  }
  if (date) orders = orders.filter((o) => matchesDate(o.payment?.capturedAt ?? o.placedAt, date));
  if (q) {
    orders = orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.payment?.cfPaymentId ?? '').toLowerCase().includes(q) ||
        (o.invoiceNo ?? '').toLowerCase().includes(q),
    );
  }

  const csv = toCsv(
    ['Order', 'Invoice no', 'Customer', 'Method', 'Cashfree order id', 'Cashfree payment id', 'Amount', 'Refunded', 'Status', 'Date'],
    orders.map((o) => [
      o.reference,
      o.invoiceNo ?? '',
      o.customerName,
      o.payment?.provider === 'cashfree' ? `Cashfree ${o.payment.method ?? ''}`.trim() : 'COD',
      o.payment?.cfOrderId ?? '',
      o.payment?.cfPaymentId ?? '',
      o.total,
      o.payment?.refunds?.reduce((s, r) => s + r.amount, 0) ?? 0,
      o.paymentStatus,
      o.payment?.capturedAt ?? o.placedAt,
    ]),
  );

  return csvResponse(`10x-transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
