import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { paginate } from '@/lib/list';
import type { Coupon } from '@/lib/types';
import { PageHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { CouponManager, NewCouponButton } from './CouponManager';

export const metadata = { title: 'Coupons' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; state?: string; page?: string; per?: string };

function stateOf(c: Coupon, now: string) {
  if (!c.active) return 'inactive';
  if (c.expiresAt && c.expiresAt < now) return 'expired';
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'used_up';
  return 'live';
}

export default async function CouponsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('coupons.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();
  const now = new Date().toISOString();

  let coupons = await readCollection<Coupon[]>('coupons');
  if (params.state) coupons = coupons.filter((c) => stateOf(c, now) === params.state);
  if (q) {
    coupons = coupons.filter(
      (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }

  const { pageItems, page, totalPages, total } = paginate(coupons, params.page, params.per);
  const canCreate = can(user, 'coupons.create');
  const canEdit = can(user, 'coupons.edit');
  const canToggle = can(user, 'coupons.toggle');
  const canDelete = can(user, 'coupons.delete');

  return (
    <>
      <PageHeader
        kicker="Store"
        title="Coupons"
        actions={
          <>
            {can(user, 'coupons.export') ? (
              <a href={`/api/export/coupons${q ? `?q=${encodeURIComponent(q)}` : ''}`} className="btn-outline">
                <Icon name="download" className="h-4 w-4" />
                Export CSV
              </a>
            ) : null}
            {canCreate ? <NewCouponButton /> : null}
          </>
        }
      />

      <FilterBar
        basePath="/coupons"
        placeholder="Search code or description…"
        filters={[
          {
            key: 'state',
            label: 'State',
            options: [
              { value: 'live', label: 'Live' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'expired', label: 'Expired' },
              { value: 'used_up', label: 'Used up' },
            ],
          },
        ]}
      />

      <CouponManager coupons={pageItems} canEdit={canEdit} canToggle={canToggle} canDelete={canDelete} />

      <Pagination basePath="/coupons" page={page} totalPages={totalPages} total={total} noun="coupons" />
    </>
  );
}
