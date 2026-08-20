import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { getMetrics } from '@/lib/metrics';
import { inr, inrCompact, fmtDateTime, fmtDate } from '@/lib/format';
import { STAGE_LABEL, type OrderStatus } from '@/lib/types';
import { PageHeader, SectionHead, StatCard, Table, OrderStatusBadge, Pill } from '@/components/ui';
import { AreaChart, BarChart, Donut, Funnel, CalendarHeat, RankBars } from '@/components/charts';
import { Icon } from '@/components/Icon';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const RANGES = [
  { key: '7', label: '7D' },
  { key: '30', label: '30D' },
  { key: '90', label: '90D' },
  { key: 'all', label: 'Lifetime' },
] as const;

function GlanceCard({
  href,
  icon,
  title,
  value,
  sub,
  show,
}: {
  href: string;
  icon: string;
  title: string;
  value: string;
  sub: string;
  show: boolean;
}) {
  if (!show) return null;
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-pressed">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-caption font-medium text-fg-muted">{title}</span>
        <span className="block truncate text-body font-semibold">{value}</span>
        <span className="block truncate text-caption text-fg-subtle">{sub}</span>
      </span>
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; denied?: string }>;
}) {
  const user = await requirePermission('dashboard.view');
  const params = await searchParams;
  const rangeKey = RANGES.some((r) => r.key === params.range) ? params.range! : '30';
  const m = await getMetrics(rangeKey === 'all' ? 'all' : Number(rangeKey));
  const rangeText = m.isLifetime ? 'lifetime' : `last ${m.rangeDays} days`;

  const labels = m.days.map((d, i) => (i % Math.ceil(m.days.length / 6) === 0 ? d.label : ''));
  const statusData = [...m.statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({ label: STAGE_LABEL[status as OrderStatus], value }));
  const payData = [...m.payMethodCounts.entries()].map(([label, value]) => ({
    label: label === 'online' ? 'Prepaid' : 'COD',
    value,
  }));

  return (
    <>
      <PageHeader
        kicker={`Welcome back, ${user.name}`}
        title="Dashboard"
        description={`A glimpse of everything happening in the store — ${rangeText}.`}
        actions={
          <div className="segment">
            {RANGES.map((r) => (
              <Link key={r.key} href={`/?range=${r.key}`} className={`segment-item ${r.key === rangeKey ? 'segment-item-active' : ''}`}>
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      {params.denied ? (
        <p className="mb-8 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-body text-warning">
          Your role doesn’t include access to that area. Ask a super admin if you need it.
        </p>
      ) : null}

      {/* Needs attention */}
      {(m.kpis.toFulfil > 0 || m.kpis.codPending > 0 || m.stockAlerts.length > 0) && can(user, 'orders.view') ? (
        <div className="mb-8 flex flex-wrap gap-2.5">
          {m.kpis.toFulfil > 0 ? (
            <Link href="/orders?status=to_fulfil">
              <Pill tone="warning">
                <Icon name="truck" className="h-3.5 w-3.5" />
                {m.kpis.toFulfil} orders waiting to ship
              </Pill>
            </Link>
          ) : null}
          {m.kpis.codPending > 0 ? (
            <Link href="/orders?payment=pending">
              <Pill tone="neutral">
                <Icon name="card" className="h-3.5 w-3.5" />
                {inr(m.kpis.codPendingAmount)} COD to collect ({m.kpis.codPending})
              </Pill>
            </Link>
          ) : null}
          {m.stockAlerts.map((a) => (
            <Link key={`${a.productId}-${a.tierName}`} href={`/products/${a.productId}`}>
              <Pill tone="danger">
                <Icon name="box" className="h-3.5 w-3.5" />
                {a.productName} {a.tierName}: {a.stock} left
              </Pill>
            </Link>
          ))}
        </div>
      ) : null}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Revenue" value={inr(m.kpis.revenue)} trend={m.isLifetime ? undefined : m.kpis.revenueTrend} icon="chart" sub="delivered only" />
        <StatCard label="Orders" value={String(m.kpis.orderCount)} trend={m.isLifetime ? undefined : m.kpis.orderTrend} icon="orders" />
        <StatCard label="Units sold" value={String(m.kpis.unitsSold)} icon="box" sub="packs of 10" />
        <StatCard label="Avg order value" value={inr(m.kpis.aov)} icon="tag" />
        <StatCard label="New customers" value={String(m.kpis.newCustomers)} trend={m.isLifetime ? undefined : m.kpis.customerTrend} icon="users" />
        <StatCard label="Active subs" value={String(m.kpis.activeSubscriptions)} icon="repeat" sub={`${inr(m.kpis.subscriptionMrr)} / cycle`} />
      </div>

      {/* Charts — dense three-column rhythm, no dead space */}
      <div className="mt-8 space-y-6">
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="card overflow-visible xl:col-span-2">
            <SectionHead title="Revenue" sub={`Delivered orders net of refunds, daily — ${rangeText}`} />
            <AreaChart points={m.days.map((d) => d.revenue)} labels={m.days.map((d) => d.label)} format="inr" height={250} />
          </div>
          <div className="card">
            <SectionHead title="Order pipeline" sub="How far this period's orders travelled" />
            <Funnel stages={m.funnel} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="card overflow-visible xl:col-span-2">
            <SectionHead title={m.rangeDays > 14 ? 'Orders per week' : 'Orders per day'} sub="Volume across the period" />
            <BarChart data={m.rangeDays > 14 ? m.weekly.map((wk) => ({ label: wk.label, value: wk.orders })) : m.days.map((d) => ({ label: d.label, value: d.orders }))} height={250} />
          </div>
          <div className="card overflow-visible">
            <SectionHead title="Orders by status" sub="Where every order stands" />
            <Donut data={statusData} centerValue={String(m.kpis.orderCount)} centerLabel="orders" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <div className="card overflow-visible">
            <SectionHead title="Payment mix" sub="How customers pay" />
            <Donut data={payData} centerValue={inrCompact(m.kpis.revenue)} centerLabel="collected" />
            <dl className="mt-4 space-y-1.5 border-t border-paper-200 pt-3 text-body-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">COD still to collect</dt>
                <dd className="font-semibold">{inr(m.kpis.codPendingAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Refunded</dt>
                <dd className="font-semibold">{m.kpis.refundedCount > 0 ? inr(m.kpis.refundedAmount) : '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="card flex flex-col">
            <SectionHead title="Sales heat" sub="Each square is a day — darker means more revenue" />
            <CalendarHeat days={m.days.map((d) => ({ date: d.date, label: d.label, value: d.revenue }))} format="inr" />
          </div>
          <div className="card">
            <SectionHead title="Top cities" sub="Revenue by delivery city" />
            <RankBars
              data={m.topCities.slice(0, 5).map(([city, v]) => ({ label: city, value: v.revenue, sub: `${v.orders} orders` }))}
              format="inr"
            />
          </div>
        </div>
      </div>

      {/* System glance — one card per area of the panel */}
      <div className="mt-10">
        <SectionHead title="Around the system" sub="A one-line pulse for every area — tap to open" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <GlanceCard
            show={can(user, 'subscriptions.view')}
            href="/subscriptions"
            icon="repeat"
            title="Subscriptions"
            value={`${m.kpis.activeSubscriptions} active`}
            sub={`${m.upcomingDeliveries.length} deliveries in the next 7 days · ${m.glance.pausedSubs} paused`}
          />
          <GlanceCard
            show={can(user, 'coupons.view')}
            href="/coupons"
            icon="tag"
            title="Coupons"
            value={`${m.glance.liveCouponCount} live`}
            sub={
              m.couponUse.size > 0
                ? `${[...m.couponUse.values()].reduce((s, u) => s + u.uses, 0)} uses this period`
                : 'No usage this period'
            }
          />
          <GlanceCard
            show={can(user, 'products.view')}
            href="/inventory"
            icon="box"
            title="Inventory"
            value={`${m.glance.totalStock} packs in stock`}
            sub={m.stockAlerts.length ? `${m.stockAlerts.length} low-stock alert${m.stockAlerts.length > 1 ? 's' : ''}` : 'All packs healthy'}
          />
          <GlanceCard
            show={can(user, 'customers.view')}
            href="/customers"
            icon="users"
            title="Customers"
            value={`${m.customers.length} total`}
            sub={`${m.kpis.repeatRate}% ordered more than once`}
          />
          <GlanceCard
            show={can(user, 'team.view')}
            href="/team"
            icon="team"
            title="Team"
            value={`${m.glance.teamActive} members active`}
            sub="Access follows each member’s role"
          />
          <GlanceCard
            show={can(user, 'analytics.view')}
            href="/analytics"
            icon="chart"
            title="Analytics"
            value="In-depth view"
            sub="Revenue, customers, geography, coupons…"
          />
        </div>
      </div>

      {/* Upcoming subscription deliveries */}
      {can(user, 'subscriptions.view') && m.upcomingDeliveries.length > 0 ? (
        <div className="mt-10">
          <SectionHead
            title="Subscription deliveries this week"
            sub="Cycles that will charge and dispatch in the next 7 days"
            action={<Link href="/subscriptions" className="text-body-sm font-medium text-accent-pressed hover:text-fg">Manage →</Link>}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {m.upcomingDeliveries.slice(0, 6).map((s) => (
              <div key={s.id} className="card flex items-center justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="truncate text-body font-semibold">{s.customerName}</p>
                  <p className="text-caption text-fg-subtle">{s.packets} · {inr(s.price)}</p>
                </div>
                <Pill tone="accent">{fmtDate(s.nextDelivery)}</Pill>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recent orders */}
      <div className="mt-10">
        <SectionHead
          title="Recent orders"
          sub="The latest across website and subscriptions"
          action={
            can(user, 'orders.view') ? (
              <Link href="/orders" className="text-body-sm font-medium text-accent-pressed hover:text-fg">
                View all →
              </Link>
            ) : undefined
          }
        />
        <Table head={['Order', 'Customer', 'Placed', 'Total', 'Payment', 'Status']}>
          {m.recentOrders.map((o) => (
            <tr key={o.id} className="transition-colors hover:bg-accent-soft/40">
              <td className="px-3 py-2.5 first:pl-4 last:pr-4 font-semibold">
                {can(user, 'orders.view') ? (
                  <Link href={`/orders/${o.id}`} className="hover:text-accent-pressed">
                    {o.reference}
                  </Link>
                ) : (
                  o.reference
                )}
              </td>
              <td className="px-3 py-2.5 first:pl-4 last:pr-4">{o.customerName}</td>
              <td className="whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 text-fg-muted">{fmtDateTime(o.placedAt)}</td>
              <td className="px-3 py-2.5 first:pl-4 last:pr-4 font-semibold">{inr(o.total)}</td>
              <td className="px-3 py-2.5 first:pl-4 last:pr-4 uppercase text-caption font-medium text-fg-muted">{o.paymentMethod}</td>
              <td className="px-3 py-2.5 first:pl-4 last:pr-4">
                <OrderStatusBadge status={o.status} />
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
