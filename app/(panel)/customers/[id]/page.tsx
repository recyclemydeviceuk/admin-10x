import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr, fmtDate, fmtDateTime } from '@/lib/format';
import { RETURN_STATUS_LABEL, type Customer, type Order, type Product, type ReturnRequest, type Subscription } from '@/lib/types';
import { PageHeader, Table, OrderStatusBadge, StatCard, Pill, BackLink, Avatar, DateCell, ProductThumb, td } from '@/components/ui';
import { productImageFor } from '@/lib/productImage';
import { Icon } from '@/components/Icon';
import { EditCustomerPanel } from '../CustomerForm';

export const dynamic = 'force-dynamic';

type Cart = {
  customerId: string;
  updatedAt: string;
  items: { sku: string; name: string; packets: string; quantity: number; price: number }[];
};

function daysBetween(iso: string | null, now = Date.now()) {
  if (!iso) return null;
  return Math.max(Math.floor((now - new Date(iso).getTime()) / 86400_000), 0);
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('customers.view');
  const { id } = await params;

  const [customers, orders, subscriptions, returns, carts, products] = await Promise.all([
    readCollection<Customer[]>('customers'),
    readCollection<Order[]>('orders'),
    readCollection<Subscription[]>('subscriptions'),
    readCollection<ReturnRequest[]>('returns'),
    readCollection<Cart[]>('carts'),
    readCollection<Product[]>('products'),
  ]);

  const customer = customers.find((c) => c.id === id);
  if (!customer) notFound();

  const theirOrders = orders
    .filter((o) => o.customerId === id)
    .sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1));
  const theirSubs = subscriptions.filter((s) => s.customerId === id);
  const theirReturns = returns.filter(
    (r) => r.customerEmail.toLowerCase() === customer.email.toLowerCase(),
  );
  const cart = carts.find((c) => c.customerId === id);
  const cartValue = cart?.items.reduce((s, i) => s + i.price * i.quantity, 0) ?? 0;
  const cartUnits = cart?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  const counted = theirOrders.filter((o) => o.status !== 'cancelled');
  const aov = counted.length ? Math.round(customer.totalSpent / counted.length) : 0;
  const firstOrder = theirOrders.at(-1)?.placedAt ?? null;
  const sinceLast = daysBetween(customer.lastOrderAt);
  const lastAddress = theirOrders[0]?.address;
  const canSeeOrders = can(user, 'orders.view');

  return (
    <>
      <BackLink href="/customers" label="All customers" />
      <PageHeader
        kicker={`Customer since ${fmtDate(customer.joinedAt)}`}
        title={customer.name}
        actions={
          <div className="flex items-center gap-2">
            {customer.hasSubscription ? <Pill tone="accent">Subscriber</Pill> : null}
            {customer.marketingOptIn ? <Pill tone="neutral">Marketing opt-in</Pill> : null}
          </div>
        }
      />

      {can(user, 'customers.edit') ? (
        <EditCustomerPanel
          customer={{
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            city: customer.city,
            state: customer.state,
            marketingOptIn: customer.marketingOptIn,
          }}
          canDelete={can(user, 'customers.delete')}
        />
      ) : null}

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Lifetime value" value={inr(customer.totalSpent)} icon="chart" />
        <StatCard label="Orders" value={String(customer.ordersCount)} icon="orders" />
        <StatCard label="Avg order value" value={aov ? inr(aov) : '—'} icon="tag" />
        <StatCard
          label="Cart right now"
          value={cartUnits > 0 ? inr(cartValue) : 'Empty'}
          sub={cartUnits > 0 ? `${cartUnits} item${cartUnits === 1 ? '' : 's'} waiting` : 'nothing added'}
          icon="box"
        />
        <StatCard label="Returns" value={String(theirReturns.length)} icon="return" />
        <StatCard
          label="Last active"
          value={sinceLast === null ? 'Never ordered' : sinceLast === 0 ? 'Today' : `${sinceLast}d ago`}
          sub={firstOrder ? `first order ${fmtDate(firstOrder)}` : undefined}
          icon="users"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ----------------------------------------------- left: history */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order history */}
          <div>
            <h2 className="text-title mb-3">Order history</h2>
            {theirOrders.length === 0 ? (
              <div className="card py-10 text-center text-body-sm text-fg-subtle">No orders yet.</div>
            ) : (
              <Table head={['Order', 'Type', 'Total', 'Payment', 'Status', 'Placed']}>
                {theirOrders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-accent-soft/40">
                    <td className={`${td} font-semibold`}>
                      {canSeeOrders ? (
                        <Link href={`/orders/${o.id}`} className="hover:text-accent-pressed">{o.reference}</Link>
                      ) : (
                        o.reference
                      )}
                    </td>
                    <td className={`${td} text-fg-muted`}>{o.channel === 'subscription' ? 'Subscription' : 'One-time'}</td>
                    <td className={`${td} whitespace-nowrap font-semibold`}>{inr(o.total)}</td>
                    <td className={`${td} uppercase text-caption font-medium text-fg-muted`}>{o.paymentMethod}</td>
                    <td className={td}><OrderStatusBadge status={o.status} /></td>
                    <td className={td}><DateCell iso={o.placedAt} /></td>
                  </tr>
                ))}
              </Table>
            )}
          </div>

          {/* Subscriptions */}
          {theirSubs.length > 0 ? (
            <div>
              <h2 className="text-title mb-3">Subscriptions</h2>
              <Table head={['Reference', 'Plan', 'Status', 'Next delivery', 'Cycles']}>
                {theirSubs.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-accent-soft/40">
                    <td className={`${td} font-semibold`}>{s.reference}</td>
                    <td className={`${td} text-fg-muted`}>{s.packets} · {inr(s.price)} {s.cadence.toLowerCase()}</td>
                    <td className={td}>
                      <Pill tone={s.status === 'active' ? 'accent' : s.status === 'paused' ? 'warning' : 'neutral'}>{s.status}</Pill>
                    </td>
                    <td className={td}><DateCell iso={s.nextDelivery} /></td>
                    <td className={`${td} tabular-nums`}>{s.cyclesDelivered}</td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : null}

          {/* Returns */}
          {theirReturns.length > 0 ? (
            <div>
              <h2 className="text-title mb-3">Returns</h2>
              <Table head={['Return', 'Order', 'Reason', 'Amount', 'Status', 'Requested']}>
                {theirReturns.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-accent-soft/40">
                    <td className={`${td} font-semibold`}>
                      {can(user, 'returns.view') ? (
                        <Link href={`/returns/${r.id}`} className="hover:text-accent-pressed">{r.reference}</Link>
                      ) : (
                        r.reference
                      )}
                    </td>
                    <td className={`${td} text-fg-muted`}>{r.orderReference}</td>
                    <td className={`${td} text-fg-muted`}>{r.reason}</td>
                    <td className={`${td} whitespace-nowrap font-semibold`}>{inr(r.amount)}</td>
                    <td className={td}>
                      <Pill tone={r.status === 'refunded' ? 'neutral' : r.status === 'rejected' ? 'danger' : 'warning'}>
                        {RETURN_STATUS_LABEL[r.status]}
                      </Pill>
                    </td>
                    <td className={td}><DateCell iso={r.requestedAt} /></td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : null}
        </div>

        {/* -------------------------------------------- right: profile */}
        <div className="space-y-6">
          {/* Live cart */}
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-title">Cart right now</h2>
              {cart?.updatedAt && cartUnits > 0 ? (
                <span className="text-caption text-fg-subtle">updated {fmtDateTime(cart.updatedAt)}</span>
              ) : null}
            </div>
            {cart && cart.items.length > 0 ? (
              <>
                <ul className="divide-y divide-paper-200">
                  {cart.items.map((item) => (
                    <li key={item.sku} className="flex items-center gap-3 py-2.5">
                      <ProductThumb src={productImageFor(products, item)} name={item.name} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="truncate text-body-sm font-semibold">{item.name}</p>
                        <p className="text-caption text-fg-subtle">{item.packets}</p>
                      </div>
                      <p className="shrink-0 text-body-sm text-fg-muted">{item.quantity} × {inr(item.price)}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-baseline justify-between border-t border-paper-200 pt-3">
                  <span className="text-body-sm text-fg-muted">Cart value</span>
                  <span className="brand-head text-[1.125rem]">{inr(cartValue)}</span>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-paper-100 text-fg-subtle">
                  <Icon name="box" className="h-4 w-4" />
                </span>
                <p className="text-body-sm text-fg-subtle">Cart is empty right now.</p>
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="card">
            <h2 className="text-title mb-4">Contact</h2>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={customer.name} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-body font-semibold">{customer.name}</p>
                <p className="truncate text-caption text-fg-subtle">{customer.email}</p>
              </div>
            </div>
            <dl className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-4 py-1.5">
                <dt className="text-body-sm text-fg-muted">Phone</dt>
                <dd className="text-body-sm font-medium">{customer.phone}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-1.5">
                <dt className="text-body-sm text-fg-muted">City</dt>
                <dd className="text-body-sm font-medium">{[customer.city, customer.state].filter(Boolean).join(', ') || '—'}</dd>
              </div>
              {lastAddress ? (
                <div className="flex items-baseline justify-between gap-4 py-1.5">
                  <dt className="shrink-0 text-body-sm text-fg-muted">Ships to</dt>
                  <dd className="min-w-0 text-right text-body-sm font-medium">
                    {lastAddress.house}, {lastAddress.street}, {lastAddress.pincode}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-4 py-1.5">
                <dt className="text-body-sm text-fg-muted">Marketing</dt>
                <dd className="text-body-sm font-medium">{customer.marketingOptIn ? 'Opted in' : 'Opted out'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
