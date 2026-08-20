import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { getMetrics } from '@/lib/metrics';
import { inr, inrCompact, fmtDate } from '@/lib/format';
import { STAGE_LABEL, type OrderStatus } from '@/lib/types';
import { PageHeader, SectionHead, StatCard, Table, Pill, td, Avatar, DateCell } from '@/components/ui';
import { AreaChart, BarChart, Donut, RankBars, Funnel, Radial, CalendarHeat, CompareBars } from '@/components/charts';
import { Icon } from '@/components/Icon';

export const metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

const RANGES = [
  { key: '7', label: '7D' },
  { key: '30', label: '30D' },
  { key: '90', label: '90D' },
  { key: 'all', label: 'Lifetime' },
] as const;

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'geography', label: 'Geography' },
  { key: 'catalogue', label: 'Products & coupons' },
  { key: 'payments', label: 'Payments & subs' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; tab?: string }>;
}) {
  const user = await requirePermission('analytics.view');
  const params = await searchParams;
  const rangeKey = RANGES.some((r) => r.key === params.range) ? params.range! : '30';
  const tab: TabKey = (TABS.some((t) => t.key === params.tab) ? params.tab : 'overview') as TabKey;
  const m = await getMetrics(rangeKey === 'all' ? 'all' : Number(rangeKey));
  const rangeText = m.isLifetime ? 'lifetime' : `last ${m.rangeDays} days`;

  const dayLabels = m.days.map((d) => d.label);
  const statusData = [...m.statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([status, value]) => ({ label: STAGE_LABEL[status as OrderStatus], value }));
  const typeData = [...m.channelCounts.entries()].map(([label, value]) => ({
    label: label === 'website' ? 'One-time purchases' : 'Subscription cycles',
    value,
  }));
  const payData = [...m.payMethodCounts.entries()].map(([label, value]) => ({
    label: label === 'online' ? 'Prepaid' : 'COD',
    value,
  }));
  const subStatusData = (['active', 'paused', 'cancelled'] as const)
    .map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: m.subscriptions.filter((x) => x.status === s).length }))
    .filter((d) => d.value > 0);

  const deliveredShare = Math.round(((m.statusCounts.get('delivered') ?? 0) / Math.max(m.kpis.orderCount, 1)) * 100);
  const prepaidShare = Math.round(((m.payMethodCounts.get('online') ?? 0) / Math.max(m.kpis.orderCount - (m.statusCounts.get('cancelled') ?? 0), 1)) * 100);
  const subscriberShare = Math.round((m.customers.filter((c) => c.hasSubscription).length / Math.max(m.customers.length, 1)) * 100);
  const marketingShare = Math.round((m.customers.filter((c) => c.marketingOptIn).length / Math.max(m.customers.length, 1)) * 100);

  const tabHref = (key: TabKey) => `/analytics?tab=${key}&range=${rangeKey}`;

  return (
    <>
      <PageHeader
        kicker="Analytics"
        title="The full picture"
        description={m.isLifetime ? 'The whole story, from the first order to today.' : `Last ${m.rangeDays} days, compared with the ${m.rangeDays} days before.`}
        actions={
          <>
            <div className="segment">
              {RANGES.map((r) => (
                <Link key={r.key} href={`/analytics?tab=${tab}&range=${r.key}`} className={`segment-item ${r.key === rangeKey ? 'segment-item-active' : ''}`}>
                  {r.label}
                </Link>
              ))}
            </div>
            {can(user, 'analytics.export') ? (
              <a href={`/api/export/sales?range=${rangeKey}`} className="btn-outline">
                <Icon name="download" className="h-4 w-4" />
                Export report
              </a>
            ) : null}
          </>
        }
      />

      {/* Tab bar */}
      <div className="scroll-x mb-6 flex gap-1 border-b border-paper-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-[12.5px] font-medium transition-colors ${
              tab === t.key
                ? 'border-accent-pressed font-semibold text-fg'
                : 'border-transparent text-fg-muted hover:border-paper-300 hover:text-fg'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* ============================================================ OVERVIEW */}
      {tab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Revenue" value={inr(m.kpis.revenue)} trend={m.isLifetime ? undefined : m.kpis.revenueTrend} icon="chart" sub="delivered only" />
            <StatCard label="Orders" value={String(m.kpis.orderCount)} trend={m.isLifetime ? undefined : m.kpis.orderTrend} icon="orders" />
            <StatCard label="Units sold" value={String(m.kpis.unitsSold)} icon="box" />
            <StatCard label="Avg order value" value={inr(m.kpis.aov)} icon="tag" />
            <StatCard label="New customers" value={String(m.kpis.newCustomers)} trend={m.isLifetime ? undefined : m.kpis.customerTrend} icon="users" />
            <StatCard label="Repeat rate" value={`${m.kpis.repeatRate}%`} icon="repeat" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card xl:col-span-2">
              <SectionHead title="Revenue per day" sub="Delivered orders net of refunds — hover for exact figures" />
              <AreaChart points={m.days.map((d) => d.revenue)} labels={dayLabels} format="inr" height={260} />
            </div>
            <div className="card">
              {m.isLifetime ? (
                <>
                  <SectionHead title="Lifetime totals" sub="Everything the store has done so far" />
                  <dl className="space-y-3">
                    {[
                      ['Total revenue', inr(m.kpis.revenue)],
                      ['Total orders', String(m.kpis.orderCount)],
                      ['Units sold', String(m.kpis.unitsSold)],
                      ['Customers', String(m.customers.length)],
                      ['Refunded', inr(m.kpis.refundedAmount)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between border-b border-paper-200 pb-2.5 last:border-0 last:pb-0">
                        <dt className="text-body-sm text-fg-muted">{label}</dt>
                        <dd className="brand-head text-[1.05rem]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <>
                  <SectionHead title="This period vs last" sub="Same length, back to back" />
                  <CompareBars
                    rows={[
                      { label: 'Revenue', current: m.kpis.revenue, previous: m.previous.revenue },
                      { label: 'Orders', current: m.kpis.orderCount, previous: m.previous.orders },
                      { label: 'New customers', current: m.kpis.newCustomers, previous: m.previous.newCustomers },
                    ]}
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div className="card">
              <SectionHead title="Order pipeline" sub="How far orders travelled" />
              <Funnel stages={m.funnel} />
            </div>
            <div className="card flex flex-col">
              <SectionHead title="Order days" sub="Each square is a day — darker means more revenue" />
              <CalendarHeat days={m.days.map((d) => ({ date: d.date, label: d.label, value: d.revenue }))} format="inr" />
            </div>
            <div className="card">
              <SectionHead title="Health at a glance" sub="Delivered and prepaid, side by side" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Radial stacked percent={deliveredShare} label="Delivered" sub={`${m.statusCounts.get('delivered') ?? 0} of ${m.kpis.orderCount} orders delivered`} />
                <Radial stacked percent={prepaidShare} label="Prepaid" sub={`${inr(m.kpis.codPendingAmount)} COD to collect`} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================ REVENUE */}
      {tab === 'revenue' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Revenue" value={inr(m.kpis.revenue)} trend={m.isLifetime ? undefined : m.kpis.revenueTrend} sub={m.isLifetime ? undefined : "vs previous period"} icon="chart" />
            <StatCard label="Avg order value" value={inr(m.kpis.aov)} sub={m.isLifetime ? undefined : `was ${inr(m.previous.aov)} last period`} icon="tag" />
            <StatCard label="Refunded" value={inr(m.kpis.refundedAmount)} sub={`${m.kpis.refundedCount} orders`} icon="return" />
            <StatCard label="Subscription revenue" value={inr(m.kpis.subscriptionMrr)} sub={`per cycle · ${m.kpis.activeSubscriptions} plans`} icon="repeat" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card">
              <SectionHead title="Revenue per day" />
              <AreaChart points={m.days.map((d) => d.revenue)} labels={dayLabels} format="inr" />
            </div>
            <div className="card">
              <SectionHead title="Cumulative revenue" sub="Running total across the period" />
              <AreaChart points={m.cumulativeRevenue} labels={dayLabels} format="inr" />
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card">
              <SectionHead title="Revenue by weekday" sub="Which days sell hardest" />
              <BarChart data={m.weekday.map((d) => ({ label: d.label, value: d.revenue }))} format="inr" height={210} />
            </div>
            <div className="card flex flex-col">
              <SectionHead title="Revenue heat" sub="Darker squares are bigger days" />
              <CalendarHeat days={m.days.map((d) => ({ date: d.date, label: d.label, value: d.revenue }))} format="inr" />
            </div>
            <div className="card">
              <SectionHead title="Order type" sub="All sales flow through the website" />
              <Donut data={typeData} centerValue={String(m.kpis.orderCount)} centerLabel="orders" />
            </div>
          </div>
        </div>
      ) : null}

      {/* ============================================================= ORDERS */}
      {tab === 'orders' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Orders" value={String(m.kpis.orderCount)} trend={m.isLifetime ? undefined : m.kpis.orderTrend} sub={m.isLifetime ? undefined : "vs previous period"} icon="orders" />
            <StatCard label="Units sold" value={String(m.kpis.unitsSold)} sub="packs of 10" icon="box" />
            <StatCard label="Waiting to ship" value={String(m.kpis.toFulfil)} href="/orders?status=to_fulfil" icon="truck" />
            <StatCard label="Delivered share" value={`${deliveredShare}%`} icon="check" />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card xl:col-span-2">
              <SectionHead title={m.rangeDays > 14 ? 'Orders per week' : 'Orders per day'} sub="Hover a bar for the exact count" />
              <BarChart data={m.rangeDays > 14 ? m.weekly.map((wk) => ({ label: wk.label, value: wk.orders })) : m.days.map((d) => ({ label: d.label, value: d.orders }))} height={260} />
            </div>
            <div className="card">
              <SectionHead title="Order pipeline" sub="Drop-off between stages in red" />
              <Funnel stages={m.funnel} />
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card">
              <SectionHead title="Status breakdown" sub="Where every order stands right now" />
              <Donut data={statusData} centerValue={String(m.kpis.orderCount)} centerLabel="orders" />
            </div>
            <div className="card">
              <SectionHead title="Orders by weekday" sub="Plan dispatch capacity around the peaks" />
              <BarChart data={m.weekday.map((d) => ({ label: d.label, value: d.orders }))} height={210} />
            </div>
            <div className="card">
              {m.isLifetime ? (
                <>
                  <SectionHead title="Cancellations & returns" sub="Orders that didn't make it" />
                  <RankBars
                    data={[
                      { label: 'Delivered', value: m.statusCounts.get('delivered') ?? 0 },
                      { label: 'Cancelled', value: m.statusCounts.get('cancelled') ?? 0 },
                      { label: 'Returned', value: m.statusCounts.get('returned') ?? 0 },
                    ]}
                  />
                </>
              ) : (
                <>
                  <SectionHead title="This period vs last" />
                  <CompareBars
                    rows={[
                      { label: 'Orders', current: m.kpis.orderCount, previous: m.previous.orders },
                      { label: 'Revenue', current: m.kpis.revenue, previous: m.previous.revenue },
                    ]}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================== CUSTOMERS */}
      {tab === 'customers' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Total customers" value={String(m.customers.length)} href="/customers" icon="users" />
            <StatCard label="New this period" value={String(m.kpis.newCustomers)} trend={m.isLifetime ? undefined : m.kpis.customerTrend} icon="plus" />
            <StatCard label="Repeat rate" value={`${m.kpis.repeatRate}%`} sub="bought more than once" icon="repeat" />
            <StatCard label="Subscribers" value={String(m.customers.filter((c) => c.hasSubscription).length)} icon="check" />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card xl:col-span-2">
              <SectionHead title="New customers per week" sub="Sign-up momentum across the period" />
              <BarChart data={m.newCustomersWeekly} height={240} />
            </div>
            <div className="card space-y-6">
              <div>
                <SectionHead title="Subscriber share" />
                <Radial percent={subscriberShare} label="Subscribers" sub="Customers on a Subscribe & Save plan." />
              </div>
              <div className="border-t border-paper-200 pt-5">
                <SectionHead title="Marketing opt-in" />
                <Radial percent={marketingShare} label="Opted in" sub="Reachable for campaigns and launches." />
              </div>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card">
              <SectionHead title="Top customers by lifetime spend" sub="Your heaviest thinkers" />
              <RankBars
                data={m.topCustomers.map((c) => ({ label: c.name, value: c.totalSpent, sub: `${c.ordersCount} orders · ${c.city}` }))}
                format="inr"
              />
            </div>
            <div>
              <SectionHead title="Most recent customers" sub="Latest sign-ups, newest first" />
              <Table head={['Customer', 'City', 'Joined', 'Orders', 'Spent']}>
                {[...m.customers]
                  .sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1))
                  .slice(0, 6)
                  .map((c, i) => (
                    <tr key={c.id} className="transition-colors hover:bg-accent-soft/40">
                      <td className={td}>
                        <Link href={`/customers/${c.id}`} className="flex items-center gap-2.5">
                          <Avatar name={c.name} seed={i} />
                          <span className="truncate font-semibold hover:text-accent-pressed">{c.name}</span>
                        </Link>
                      </td>
                      <td className={`${td} text-fg-muted`}>{c.city}</td>
                      <td className={td}><DateCell iso={c.joinedAt} /></td>
                      <td className={`${td} tabular-nums`}>{c.ordersCount}</td>
                      <td className={`${td} font-semibold`}>{inr(c.totalSpent)}</td>
                    </tr>
                  ))}
              </Table>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================== GEOGRAPHY */}
      {tab === 'geography' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Cities reached" value={String(m.topCities.length)} icon="truck" />
            <StatCard label="Top city" value={m.topCities[0]?.[0] ?? '—'} sub={m.topCities[0] ? inr(m.topCities[0][1].revenue) : undefined} icon="chart" />
            <StatCard
              label="Top city share"
              value={`${Math.round(((m.topCities[0]?.[1].revenue ?? 0) / Math.max(m.kpis.revenue, 1)) * 100)}%`}
              sub="of period revenue"
              icon="tag"
            />
            <StatCard label="Orders / city (avg)" value={String(Math.round(m.kpis.orderCount / Math.max(m.topCities.length, 1)))} icon="orders" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card">
              <SectionHead title="Revenue by city" sub="Ranked by what each city spent" />
              <RankBars data={m.topCities.map(([city, v]) => ({ label: city, value: v.revenue, sub: `${v.orders} orders` }))} format="inr" />
            </div>
            <div className="card">
              <SectionHead title="Orders by city" sub="Share of order volume" />
              <Donut
                data={m.topCities.slice(0, 6).map(([city, v]) => ({ label: city, value: v.orders }))}
                centerValue={String(m.kpis.orderCount)}
                centerLabel="orders"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================== CATALOGUE */}
      {tab === 'catalogue' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Units sold" value={String(m.kpis.unitsSold)} sub="this period" icon="box" />
            <StatCard label="Packs in stock" value={String(m.glance.totalStock)} href="/products" icon="layout" />
            <StatCard label="Low-stock alerts" value={String(m.stockAlerts.length)} icon="truck" />
            <StatCard label="Live coupons" value={String(m.glance.liveCouponCount)} href="/coupons" icon="tag" />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card">
              <SectionHead title="Units sold per day" sub="Packs leaving the shelf" />
              <BarChart data={m.days.map((d) => ({ label: d.label, value: d.units }))} />
            </div>
            <div className="card">
              <SectionHead title="Stock by pack" sub="What's left, against its low-stock line" />
              <RankBars
                data={m.products.flatMap((p) =>
                  p.tiers.map((t) => ({
                    label: `${p.name} — ${t.name}${t.available ? '' : ' (off sale)'}`,
                    value: t.stock,
                    sub: t.available && t.stock <= t.lowStockAt ? `below the ${t.lowStockAt}-unit alert line` : undefined,
                  })),
                )}
              />
            </div>
          </div>
          <div>
            <SectionHead title="Coupon performance" sub="What each code drove in this period" />
            {m.couponUse.size === 0 ? (
              <p className="card text-body-sm text-fg-muted">No coupons were used in this period.</p>
            ) : (
              <Table head={['Code', 'Uses', 'Discount given', 'Revenue with code', 'Avg discount']}>
                {[...m.couponUse.entries()].map(([code, u]) => (
                  <tr key={code} className="transition-colors hover:bg-accent-soft/40">
                    <td className={`${td} font-semibold uppercase`}>{code}</td>
                    <td className={`${td} tabular-nums`}>{u.uses}</td>
                    <td className={td}>{inr(u.discount)}</td>
                    <td className={td}>{inr(u.revenue)}</td>
                    <td className={`${td} text-fg-muted`}>{inr(Math.round(u.discount / u.uses))}</td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      ) : null}

      {/* =========================================================== PAYMENTS */}
      {tab === 'payments' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Collected" value={inr(m.kpis.revenue)} sub="this period" icon="card" />
            <StatCard label="COD pending" value={inr(m.kpis.codPendingAmount)} sub={`${m.kpis.codPending} orders`} href="/orders?payment=pending" icon="truck" />
            <StatCard label="Refunded" value={inr(m.kpis.refundedAmount)} sub={`${m.kpis.refundedCount} orders`} icon="return" />
            <StatCard label="Active subscriptions" value={String(m.kpis.activeSubscriptions)} sub={`${inr(m.kpis.subscriptionMrr)} / cycle`} icon="repeat" />
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card">
              <SectionHead title="Payment method" sub="How customers choose to pay" />
              <Donut data={payData} centerValue={inrCompact(m.kpis.revenue)} centerLabel="collected" />
            </div>
            <div className="card">
              <SectionHead title="Prepaid share" />
              <Radial percent={prepaidShare} label="Prepaid" sub="Money in the bank before dispatch. The higher this gets, the lighter your COD risk." />
            </div>
            <div className="card">
              <SectionHead title="Subscription plans" sub="Health of recurring revenue" />
              <Donut data={subStatusData} centerValue={String(m.subscriptions.length)} centerLabel="plans" />
            </div>
          </div>
          <div>
            <SectionHead title="Next subscription deliveries" sub="Charging and dispatching within 7 days" />
            {m.upcomingDeliveries.length === 0 ? (
              <p className="card text-body-sm text-fg-muted">Nothing due in the next 7 days.</p>
            ) : (
              <Table head={['Customer', 'Plan', 'Price', 'Delivers']}>
                {m.upcomingDeliveries.map((s, i) => (
                  <tr key={s.id} className="transition-colors hover:bg-accent-soft/40">
                    <td className={td}>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={s.customerName} seed={i} />
                        <span className="truncate font-semibold">{s.customerName}</span>
                      </span>
                    </td>
                    <td className={`${td} text-fg-muted`}>{s.packets} · {s.cadence.toLowerCase()}</td>
                    <td className={`${td} font-semibold`}>{inr(s.price)}</td>
                    <td className={td}><Pill tone="accent">{fmtDate(s.nextDelivery)}</Pill></td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
