import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import { paginate, parseSort, matchesDate } from '@/lib/list';
import type { Customer, Product, Subscription } from '@/lib/types';
import { PageHeader, Table, Pill, EmptyState, Avatar, DateCell, ProductThumb, td } from '@/components/ui';
import { productImageFor } from '@/lib/productImage';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { SortHeader } from '@/components/list/SortHeader';
import { SubscriptionRowActions } from './SubscriptionRowActions';
import { NewSubscriptionForm } from './NewSubscriptionForm';

export const metadata = { title: 'Subscriptions' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; status?: string; date?: string; sort?: string; page?: string; per?: string };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('subscriptions.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();
  const canCreate = can(user, 'subscriptions.create');
  const canPause = can(user, 'subscriptions.pause');
  const canEdit = can(user, 'subscriptions.edit');
  const canCancel = can(user, 'subscriptions.cancel');
  const canDelete = can(user, 'subscriptions.delete');
  const canAct = canPause || canCancel || canDelete || canEdit;

  const [allSubs, customers, products] = await Promise.all([
    readCollection<Subscription[]>('subscriptions'),
    readCollection<Customer[]>('customers'),
    readCollection<Product[]>('products'),
  ]);

  // Every orderable pack, priced at the catalogue's own subscribe price, and
  // the store's delivery cadence — nothing about a manual plan is invented here.
  const packs = products
    .filter((p) => p.status === 'active')
    .flatMap((p) =>
      p.tiers.filter((t) => t.available).map((t) => ({ id: `${p.id}:${t.id}`, label: `${p.name} — ${t.name}`, subscribePrice: t.subscribePrice })),
    );
  const settings = await readCollection<{ store?: { subscriptionIntervalDays?: number } }>('settings').catch(() => null);
  const intervalDays = settings?.store?.subscriptionIntervalDays ?? 28;

  let subs = allSubs;
  if (params.status) subs = subs.filter((s) => s.status === params.status);
  if (params.date) subs = subs.filter((s) => matchesDate(s.startedAt, params.date));
  if (q) {
    subs = subs.filter(
      (s) => s.reference.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q),
    );
  }

  const [sortField, dir] = parseSort(params.sort, 'nextDelivery', 1);
  subs = [...subs].sort((a, b) => {
    const val = (s: Subscription) =>
      sortField === 'startedAt' ? s.startedAt
      : sortField === 'price' ? s.price
      : s.nextDelivery ?? '9999';
    const av = val(a);
    const bv = val(b);
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  const { pageItems, page, totalPages, total } = paginate(subs, params.page, params.per);

  const exportQs = new URLSearchParams();
  if (params.status) exportQs.set('status', params.status);
  if (params.date) exportQs.set('date', params.date);
  if (q) exportQs.set('q', q);

  return (
    <>
      <PageHeader
        kicker="Store"
        title="Subscriptions"
        actions={
          <>
            {can(user, 'subscriptions.export') ? (
              <a href={`/api/export/subscriptions?${exportQs}`} className="btn-outline">
                <Icon name="download" className="h-4 w-4" />
                Export CSV
              </a>
            ) : null}
            {canCreate ? (
              <NewSubscriptionForm
                customers={customers
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => ({ id: c.id, name: c.name, email: c.email }))}
                packs={packs}
                intervalDays={intervalDays}
              />
            ) : null}
          </>
        }
      />

      <FilterBar
        basePath="/subscriptions"
        placeholder="Search reference or customer…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
        ]}
        withDate
        dateLabel="Started"
      />

      {pageItems.length === 0 ? (
        <EmptyState title="No subscriptions match" />
      ) : (
        <Table
          head={[
            'Subscription',
            'Plan',
            <SortHeader key="p" basePath="/subscriptions" field="price">Price</SortHeader>,
            'Status',
            <SortHeader key="n" basePath="/subscriptions" field="nextDelivery">Next delivery</SortHeader>,
            'Cycles',
            <SortHeader key="s" basePath="/subscriptions" field="startedAt">Started</SortHeader>,
            ...(canAct ? [<span key="a" className="block text-right">Actions</span>] : []),
          ]}
        >
          {pageItems.map((s, i) => (
            <tr key={s.id} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <span className="flex items-center gap-2.5">
                  <Avatar name={s.customerName} seed={i} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold">{s.reference}</span>
                    {can(user, 'customers.view') ? (
                      <Link href={`/customers/${s.customerId}`} className="block truncate text-[11px] text-fg-subtle hover:text-accent-pressed">
                        {s.customerName}
                      </Link>
                    ) : (
                      <span className="block truncate text-[11px] text-fg-subtle">{s.customerName}</span>
                    )}
                  </span>
                </span>
              </td>
              <td className={`${td} whitespace-nowrap text-fg-muted`}>
                <span className="flex items-center gap-2">
                  <ProductThumb src={productImageFor(products, { productId: s.productId, name: s.productName })} name={s.productName} />
                  <span>{s.packets} · {s.cadence.toLowerCase()}</span>
                </span>
              </td>
              <td className={`${td} whitespace-nowrap font-semibold`}>{inr(s.price)}</td>
              <td className={td}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={s.status === 'active' ? 'accent' : s.status === 'paused' ? 'warning' : 'neutral'}>{s.status}</Pill>
                  {s.autopay === 'active' ? (
                    <Pill tone="accent">auto-pay</Pill>
                  ) : s.autopay === 'failed' || s.autopayLastCharge === 'failed' ? (
                    <Pill tone="warning">auto-pay issue</Pill>
                  ) : s.autopay === 'initialized' ? (
                    <Pill tone="warning">auto-pay pending</Pill>
                  ) : s.autopayDeclined ? (
                    <Pill tone="neutral">pay on delivery</Pill>
                  ) : s.status === 'active' ? (
                    <Pill tone="neutral">{s.autopayReminders ? `reminded ×${s.autopayReminders}` : 'no auto-pay'}</Pill>
                  ) : null}
                </span>
              </td>
              <td className={td}><DateCell iso={s.nextDelivery} /></td>
              <td className={`${td} tabular-nums`}>{s.cyclesDelivered}</td>
              <td className={td}><DateCell iso={s.startedAt} /></td>
              {canAct ? (
                <td className={td}>
                  <div className="flex justify-end">
                    <SubscriptionRowActions
                      subId={s.id}
                      status={s.status}
                      canPause={canPause}
                      canCancel={canCancel}
                      canDelete={canDelete}
                      canRemind={canEdit && s.status === 'active' && s.autopay !== 'active' && s.autopay !== 'initialized' && !s.autopayDeclined}
                    />
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </Table>
      )}

      <Pagination basePath="/subscriptions" page={page} totalPages={totalPages} total={total} noun="subscriptions" />
    </>
  );
}
