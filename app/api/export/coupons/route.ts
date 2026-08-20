import { getSessionUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { toCsv, csvResponse } from '@/lib/csv';
import type { Coupon } from '@/lib/types';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !can(user, 'coupons.export')) {
    return new Response('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.toLowerCase();

  let coupons = await readCollection<Coupon[]>('coupons');
  if (q) {
    coupons = coupons.filter(
      (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }

  const csv = toCsv(
    ['Code', 'Description', 'Type', 'Value', 'Min order', 'Max discount', 'Usage limit', 'Used', 'Per-customer limit', 'Starts', 'Expires', 'Active', 'Created by'],
    coupons.map((c) => [
      c.code,
      c.description,
      c.type,
      c.value,
      c.minOrder,
      c.maxDiscount ?? '',
      c.usageLimit ?? 'unlimited',
      c.usedCount,
      c.perCustomerLimit ?? 'unlimited',
      c.startsAt,
      c.expiresAt ?? 'never',
      c.active ? 'yes' : 'no',
      c.createdBy,
    ]),
  );

  return csvResponse(`10x-coupons-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
