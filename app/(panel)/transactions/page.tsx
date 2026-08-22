import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import { paginate, parseSort, matchesDate } from '@/lib/list';
import type { Order } from '@/lib/types';
import { PageHeader, Table, PaymentBadge, EmptyState, Avatar, DateCell, td } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { SortHeader } from '@/components/list/SortHeader';
import { TransactionRowActions } from './TransactionRowActions';

export const metadata = { title: 'Transactions' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; status?: string; method?: string; date?: string; sort?: string; page?: string; per?: string };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('transactions.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let orders = await readCollection<Order[]>('orders');

  if (params.status) orders = orders.filter((o) => o.paymentStatus === params.status);
  if (params.method) {
    orders = orders.filter((o) =>
      params.method === 'cashfree' ? o.payment?.provider === 'cashfree' : o.payment?.provider !== 'cashfree',
    );
  }
  if (params.date) orders = orders.filter((o) => matchesDate(o.payment?.capturedAt ?? o.placedAt, params.date));
  if (q) {
    orders = orders.filter(
      (o) =>
        o.reference.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.payment?.cfOrderId ?? '').toLowerCase().includes(q) ||
        (o.payment?.cfPaymentId ?? '').toLowerCase().includes(q) ||
        (o.invoiceNo ?? '').toLowerCase().includes(q),
    );
  }

  const exportQs = new URLSearchParams();
  if (params.status) exportQs.set('status', params.status);
  if (params.method) exportQs.set('method', params.method);
  if (params.date) exportQs.set('date', params.date);
  if (q) exportQs.set('q', q);

  const [sortField, dir] = parseSort(params.sort, 'placedAt');
  orders.sort((a, b) => {
    const av = sortField === 'total' ? a.total : a.placedAt;
    const bv = sortField === 'total' ? b.total : b.placedAt;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  const { pageItems, page, totalPages, total } = paginate(orders, params.page, params.per);

  return (
    <>
      <PageHeader
        kicker="Store"
        title="Transactions"
        actions={
          can(user, 'transactions.export') ? (
            <a href={`/api/export/transactions?${exportQs}`} className="btn-outline">
              <Icon name="download" className="h-4 w-4" />
              Export CSV
            </a>
          ) : undefined
        }
      />

      <FilterBar
        basePath="/transactions"
        placeholder="Search order, customer, Cashfree ID, invoice no…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'refunded', label: 'Refunded' },
              { value: 'failed', label: 'Failed' },
            ],
          },
          {
            key: 'method',
            label: 'Method',
            options: [
              { value: 'cashfree', label: 'Cashfree (prepaid)' },
              { value: 'cod', label: 'Cash on delivery' },
            ],
          },
        ]}
        withDate
      />

      {pageItems.length === 0 ? (
        <EmptyState title="No transactions match" hint="Try different filters or clear the search." />
      ) : (
        <Table
          head={[
            'Transaction',
            'Order',
            'Method',
            <SortHeader key="t" basePath="/transactions" field="total">Amount</SortHeader>,
            'Status',
            'Invoice',
            <SortHeader key="d" basePath="/transactions" field="placedAt">Date</SortHeader>,
            <span key="a" className="block text-right">Actions</span>,
          ]}
        >
          {pageItems.map((o, i) => {
            const isCashfree = o.payment?.provider === 'cashfree';
            return (
              <tr key={o.id} className="transition-colors hover:bg-accent-soft/40">
                <td className={td}>
                  <span className="flex items-center gap-2.5">
                    <Avatar name={o.customerName} seed={i} />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-semibold">
                        {isCashfree ? (o.payment?.cfPaymentId ?? o.payment?.cfOrderId ?? 'Prepaid') : 'Cash on delivery'}
                      </span>
                      <span className="block truncate text-[11px] text-fg-subtle">{o.customerName}</span>
                    </span>
                  </span>
                </td>
                <td className={td}>
                  <Link href={`/orders/${o.id}`} className="font-medium hover:text-accent-pressed">
                    {o.reference}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap text-fg-muted`}>
                  {isCashfree ? `Cashfree${o.payment?.method ? ` · ${o.payment.method.toUpperCase()}` : ''}` : 'COD'}
                </td>
                <td className={`${td} whitespace-nowrap font-semibold`}>
                  {inr(o.total)}
                  {o.payment?.refunds?.length ? (
                    <span className="block text-[11px] font-normal text-danger">
                      −{inr(o.payment.refunds.reduce((s, r) => s + r.amount, 0))} refunded
                    </span>
                  ) : null}
                </td>
                <td className={td}><PaymentBadge status={o.paymentStatus} /></td>
                <td className={`${td} whitespace-nowrap text-fg-muted`}>{o.invoiceNo ?? '—'}</td>
                <td className={td}><DateCell iso={o.payment?.capturedAt ?? o.placedAt} /></td>
                <td className={td}>
                  <TransactionRowActions orderId={o.id} isCashfree={isCashfree} canInvoice={can(user, 'orders.invoice')} />
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <Pagination basePath="/transactions" page={page} totalPages={totalPages} total={total} noun="transactions" />
    </>
  );
}
