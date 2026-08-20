import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import { paginate, parseSort, matchesDate } from '@/lib/list';
import { STAGE_LABEL, ORDER_STAGES, type Order } from '@/lib/types';
import { PageHeader, Table, OrderStatusBadge, PaymentBadge, EmptyState, Avatar, DateCell, td } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { SortHeader } from '@/components/list/SortHeader';
import { OrderRowActions } from './OrderRowActions';

export const metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

type Params = {
  q?: string;
  status?: string;
  payment?: string;
  channel?: string;
  date?: string;
  sort?: string;
  page?: string;
  per?: string;
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('orders.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let orders = await readCollection<Order[]>('orders');

  // Filters
  if (params.status && params.status !== 'all') {
    orders =
      params.status === 'to_fulfil'
        ? orders.filter((o) => ['placed', 'confirmed', 'packed'].includes(o.status))
        : orders.filter((o) => o.status === params.status);
  }
  if (params.payment) orders = orders.filter((o) => o.paymentStatus === params.payment);
  if (params.channel) orders = orders.filter((o) => o.channel === params.channel);
  if (params.date) orders = orders.filter((o) => matchesDate(o.placedAt, params.date));
  if (q) {
    orders = orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.address.city.toLowerCase().includes(q) ||
        o.address.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        (o.trackingNumber ?? '').toLowerCase().includes(q),
    );
  }

  // Sort
  const [sortField, dir] = parseSort(params.sort, 'placedAt');
  orders.sort((a, b) => {
    const av = sortField === 'total' ? a.total : a.placedAt;
    const bv = sortField === 'total' ? b.total : b.placedAt;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  const { pageItems, page, totalPages, total } = paginate(orders, params.page, params.per);

  const exportQs = new URLSearchParams();
  if (params.status) exportQs.set('status', params.status);
  if (params.payment) exportQs.set('payment', params.payment);
  if (params.channel) exportQs.set('channel', params.channel);
  if (params.date) exportQs.set('date', params.date);
  if (q) exportQs.set('q', q);

  return (
    <>
      <PageHeader
        kicker="Store"
        title="Orders"
        actions={
          <>
            {can(user, 'orders.export') ? (
              <a href={`/api/export/orders?${exportQs}`} className="btn-outline">
                <Icon name="download" className="h-4 w-4" />
                Export CSV
              </a>
            ) : null}
            {can(user, 'orders.create') ? (
              <Link href="/orders/new" className="btn-accent">
                <Icon name="plus" className="h-4 w-4" />
                New order
              </Link>
            ) : null}
          </>
        }
      />

      <FilterBar
        basePath="/orders"
        placeholder="Search reference, customer, phone, city, AWB…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'to_fulfil', label: 'To fulfil' },
              ...ORDER_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'returned', label: 'Returned' },
            ],
          },
          {
            key: 'payment',
            label: 'Payment',
            options: [
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'refunded', label: 'Refunded' },
              { value: 'failed', label: 'Failed' },
            ],
          },
          {
            key: 'channel',
            label: 'Type',
            options: [
              { value: 'website', label: 'One-time purchase' },
              { value: 'subscription', label: 'Subscription cycle' },
            ],
          },
        ]}
        withDate
        dateLabel="Placed"
      />

      {pageItems.length === 0 ? (
        <EmptyState title="No orders match" hint="Try different filters or clear the search." />
      ) : (
        <Table
          head={[
            'Order',
            'City',
            'Items',
            <SortHeader key="total" basePath="/orders" field="total">Total</SortHeader>,
            'Payment',
            'Status',
            <SortHeader key="placed" basePath="/orders" field="placedAt">Placed</SortHeader>,
            <span key="a" className="block text-right">Actions</span>,
          ]}
        >
          {pageItems.map((o, i) => (
            <tr key={o.id} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-2.5">
                  <Avatar name={o.customerName} seed={i} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold hover:text-accent-pressed">
                      {o.reference}
                      {o.channel === 'subscription' ? (
                        <span className="ml-1.5 rounded bg-paper-100 px-1 py-px text-[9px] font-bold uppercase text-fg-subtle">Sub</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-fg-subtle">{o.customerName}</span>
                  </span>
                </Link>
              </td>
              <td className={`${td} whitespace-nowrap text-fg-muted`}>{o.address.city}</td>
              <td className={`${td} whitespace-nowrap text-fg-muted`}>
                {o.items.reduce((s, x) => s + x.quantity, 0)} × {o.items[0]?.packets}
              </td>
              <td className={`${td} whitespace-nowrap font-semibold`}>{inr(o.total)}</td>
              <td className={td}><PaymentBadge status={o.paymentStatus} /></td>
              <td className={td}><OrderStatusBadge status={o.status} /></td>
              <td className={td}><DateCell iso={o.placedAt} /></td>
              <td className={td}>
                <OrderRowActions orderId={o.id} reference={o.reference} canDelete={can(user, 'orders.delete')} />
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination basePath="/orders" page={page} totalPages={totalPages} total={total} noun="orders" />
    </>
  );
}
