import { getSessionUser, can } from '@/lib/auth';
import { getMetrics } from '@/lib/metrics';
import { toCsv, csvResponse } from '@/lib/csv';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'analytics.export')) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const raw = url.searchParams.get('range');
  const range = raw === 'all' ? ('all' as const) : [7, 30, 90].includes(Number(raw)) ? Number(raw) : 30;
  const m = await getMetrics(range);

  const csv = toCsv(
    ['Date', 'Orders', 'Revenue (₹)'],
    m.days.map((d) => [d.date, d.orders, d.revenue]),
  );

  return csvResponse(`10x-sales-${range === 'all' ? 'lifetime' : `${range}d`}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
