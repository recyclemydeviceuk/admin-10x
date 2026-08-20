import { getSessionUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { toCsv, csvResponse } from '@/lib/csv';
import { matchesDate } from '@/lib/list';
import type { Customer } from '@/lib/types';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'customers.export')) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase();
  const segment = url.searchParams.get('segment');
  const date = url.searchParams.get('date') ?? undefined;

  let customers = await readCollection<Customer[]>('customers');
  if (segment === 'subscribers') customers = customers.filter((c) => c.hasSubscription);
  if (segment === 'repeat') customers = customers.filter((c) => c.ordersCount > 1);
  if (segment === 'marketing') customers = customers.filter((c) => c.marketingOptIn);
  if (date) customers = customers.filter((c) => matchesDate(c.joinedAt, date));
  if (q) {
    customers = customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q),
    );
  }
  const csv = toCsv(
    ['Name', 'Email', 'Phone', 'City', 'State', 'Joined', 'Orders', 'Total spent', 'Last order', 'Subscriber', 'Marketing opt-in'],
    customers.map((c) => [
      c.name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.joinedAt,
      c.ordersCount,
      c.totalSpent,
      c.lastOrderAt ?? '',
      c.hasSubscription ? 'yes' : 'no',
      c.marketingOptIn ? 'yes' : 'no',
    ]),
  );

  return csvResponse(`10x-customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
