import { getSessionUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { toCsv, csvResponse } from '@/lib/csv';
import { matchesDate } from '@/lib/list';
import type { Subscription } from '@/lib/types';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'subscriptions.export')) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const date = url.searchParams.get('date') ?? undefined;
  const q = url.searchParams.get('q')?.toLowerCase();

  let subs = await readCollection<Subscription[]>('subscriptions');
  if (status) subs = subs.filter((s) => s.status === status);
  if (date) subs = subs.filter((s) => matchesDate(s.startedAt, date));
  if (q) {
    subs = subs.filter(
      (s) => s.reference.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q),
    );
  }

  const csv = toCsv(
    ['Reference', 'Customer', 'Plan', 'Price / cycle', 'Cadence', 'Status', 'Started', 'Next delivery', 'Cycles delivered'],
    subs.map((s) => [
      s.reference,
      s.customerName,
      `${s.productName} ${s.packets}`,
      s.price,
      s.cadence,
      s.status,
      s.startedAt,
      s.nextDelivery ?? '',
      s.cyclesDelivered,
    ]),
  );

  return csvResponse(`10x-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
