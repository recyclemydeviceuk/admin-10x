import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import { paginate, parseSort, matchesDate } from '@/lib/list';
import { RETURN_STATUSES, RETURN_STATUS_LABEL, RETURN_REASONS, type ReturnRequest, type ReturnStatus } from '@/lib/types';
import { PageHeader, Table, Pill, EmptyState, Avatar, DateCell, td } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { SortHeader } from '@/components/list/SortHeader';

export const metadata = { title: 'Returns' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; status?: string; reason?: string; date?: string; sort?: string; page?: string; per?: string };

const STATUS_TONE: Record<ReturnStatus, 'neutral' | 'accent' | 'warning' | 'danger'> = {
  requested: 'warning',
  approved: 'accent',
  received: 'accent',
  refunded: 'neutral',
  rejected: 'danger',
};

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission('returns.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let returns = await readCollection<ReturnRequest[]>('returns');
  if (params.status) returns = returns.filter((r) => r.status === params.status);
  if (params.reason) returns = returns.filter((r) => r.reason === params.reason);
  if (params.date) returns = returns.filter((r) => matchesDate(r.requestedAt, params.date));
  if (q) {
    returns = returns.filter(
      (r) =>
        r.reference.toLowerCase().includes(q) ||
        r.orderReference.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.customerEmail.toLowerCase().includes(q),
    );
  }

  const [sortField, dir] = parseSort(params.sort, 'requestedAt');
  returns.sort((a, b) => {
    const av = sortField === 'amount' ? a.amount : a.requestedAt;
    const bv = sortField === 'amount' ? b.amount : b.requestedAt;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  const { pageItems, page, totalPages, total } = paginate(returns, params.page, params.per);

  return (
    <>
      <PageHeader kicker="Store" title="Returns" />

      <FilterBar
        basePath="/returns"
        placeholder="Search return, order, customer…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: RETURN_STATUSES.map((s) => ({ value: s, label: RETURN_STATUS_LABEL[s] })),
          },
          {
            key: 'reason',
            label: 'Reason',
            options: RETURN_REASONS.map((r) => ({ value: r, label: r })),
          },
        ]}
        withDate
        dateLabel="Requested"
      />

      {pageItems.length === 0 ? (
        <EmptyState
          title="No return requests match"
          hint="Customer return requests from the website land here in real time."
        />
      ) : (
        <Table
          head={[
            'Return',
            'Order',
            'Reason',
            <SortHeader key="a" basePath="/returns" field="amount">Amount</SortHeader>,
            'Photos',
            'Status',
            <SortHeader key="d" basePath="/returns" field="requestedAt">Requested</SortHeader>,
            <span key="x" className="block text-right">Actions</span>,
          ]}
        >
          {pageItems.map((r, i) => (
            <tr key={r.id} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <Link href={`/returns/${r.id}`} className="flex items-center gap-2.5">
                  <Avatar name={r.customerName} seed={i} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold hover:text-accent-pressed">{r.reference}</span>
                    <span className="block truncate text-[11px] text-fg-subtle">{r.customerName}</span>
                  </span>
                </Link>
              </td>
              <td className={td}>
                <Link href={`/orders/${r.orderId}`} className="font-medium hover:text-accent-pressed">
                  {r.orderReference}
                </Link>
              </td>
              <td className={`${td} text-fg-muted`}>{r.reason}</td>
              <td className={`${td} whitespace-nowrap font-semibold`}>{inr(r.amount)}</td>
              <td className={`${td} tabular-nums text-fg-muted`}>{r.photos.length || '—'}</td>
              <td className={td}>
                <Pill tone={STATUS_TONE[r.status]}>{RETURN_STATUS_LABEL[r.status]}</Pill>
              </td>
              <td className={td}><DateCell iso={r.requestedAt} /></td>
              <td className={td}>
                <div className="flex items-center justify-end">
                  <Link
                    href={`/returns/${r.id}`}
                    title="Review return"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-accent-soft hover:text-accent-pressed"
                  >
                    <Icon name="chevronRight" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination basePath="/returns" page={page} totalPages={totalPages} total={total} noun="returns" />
    </>
  );
}
