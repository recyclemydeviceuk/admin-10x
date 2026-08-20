import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import { paginate, parseSort, matchesDate } from '@/lib/list';
import type { Customer } from '@/lib/types';
import { PageHeader, Table, Pill, EmptyState, Avatar, DateCell, td } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { SortHeader } from '@/components/list/SortHeader';
import { AddCustomerButton } from './CustomerForm';

export const metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; segment?: string; date?: string; sort?: string; page?: string; per?: string };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('customers.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let customers = await readCollection<Customer[]>('customers');

  if (params.segment === 'subscribers') customers = customers.filter((c) => c.hasSubscription);
  if (params.segment === 'repeat') customers = customers.filter((c) => c.ordersCount > 1);
  if (params.segment === 'marketing') customers = customers.filter((c) => c.marketingOptIn);
  if (params.date) customers = customers.filter((c) => matchesDate(c.joinedAt, params.date));
  if (q) {
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        c.city.toLowerCase().includes(q),
    );
  }

  const [sortField, dir] = parseSort(params.sort, 'lastOrderAt');
  customers.sort((a, b) => {
    const val = (c: Customer) =>
      sortField === 'totalSpent' ? c.totalSpent
      : sortField === 'ordersCount' ? c.ordersCount
      : sortField === 'joinedAt' ? c.joinedAt
      : c.lastOrderAt ?? '';
    const av = val(a);
    const bv = val(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  const { pageItems, page, totalPages, total } = paginate(customers, params.page, params.per);

  const exportQs = new URLSearchParams();
  if (params.segment) exportQs.set('segment', params.segment);
  if (params.date) exportQs.set('date', params.date);
  if (q) exportQs.set('q', q);

  return (
    <>
      <PageHeader
        kicker="Store"
        title="Customers"
        actions={
          <>
            {can(user, 'customers.export') ? (
              <a href={`/api/export/customers?${exportQs}`} className="btn-outline">
                <Icon name="download" className="h-4 w-4" />
                Export CSV
              </a>
            ) : null}
            {can(user, 'customers.create') ? <AddCustomerButton /> : null}
          </>
        }
      />

      <FilterBar
        basePath="/customers"
        placeholder="Search name, email, phone, city…"
        filters={[
          {
            key: 'segment',
            label: 'Segment',
            options: [
              { value: 'subscribers', label: 'Subscribers' },
              { value: 'repeat', label: 'Repeat buyers' },
              { value: 'marketing', label: 'Marketing opt-in' },
            ],
          },
        ]}
        withDate
        dateLabel="Joined"
      />

      {pageItems.length === 0 ? (
        <EmptyState title="No customers match" />
      ) : (
        <Table
          head={[
            'Customer',
            'City',
            <SortHeader key="j" basePath="/customers" field="joinedAt">Joined</SortHeader>,
            <SortHeader key="o" basePath="/customers" field="ordersCount">Orders</SortHeader>,
            <SortHeader key="s" basePath="/customers" field="totalSpent">Total spent</SortHeader>,
            <SortHeader key="l" basePath="/customers" field="lastOrderAt">Last order</SortHeader>,
            'Tags',
            <span key="a" className="block text-right">Actions</span>,
          ]}
        >
          {pageItems.map((c, i) => (
            <tr key={c.id} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <Link href={`/customers/${c.id}`} className="flex items-center gap-2.5">
                  <Avatar name={c.name} seed={i} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold hover:text-accent-pressed">{c.name}</span>
                    <span className="block truncate text-[11px] text-fg-subtle">{c.email}</span>
                  </span>
                </Link>
              </td>
              <td className={`${td} whitespace-nowrap text-fg-muted`}>{c.city}</td>
              <td className={td}><DateCell iso={c.joinedAt} /></td>
              <td className={`${td} tabular-nums`}>{c.ordersCount}</td>
              <td className={`${td} whitespace-nowrap font-semibold`}>{inr(c.totalSpent)}</td>
              <td className={td}><DateCell iso={c.lastOrderAt} /></td>
              <td className={td}>{c.hasSubscription ? <Pill tone="accent">Subscriber</Pill> : null}</td>
              <td className={td}>
                <div className="flex items-center justify-end">
                  <Link
                    href={`/customers/${c.id}`}
                    title="Open customer"
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

      <Pagination basePath="/customers" page={page} totalPages={totalPages} total={total} noun="customers" />
    </>
  );
}
