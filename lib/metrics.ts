import 'server-only';
import { readCollection } from './db';
import { backendFetch } from './backend';
import type {
  Coupon,
  Customer,
  Order,
  Product,
  Subscription,
} from './types';

// "Counted" = order volume that still stands (everything except cancelled).
const counted = (o: Order) => o.status !== 'cancelled';

/**
 * What an order has actually EARNED — the founder's revenue rule:
 * money is recognised only when the box is delivered. An order still on the
 * road earns nothing yet; a refund takes its money back out (a fully refunded
 * or returned order earns 0, a partial refund comes off the total).
 */
const earned = (o: Order): number => {
  if (o.status !== 'delivered') return 0;
  if (o.paymentStatus === 'refunded') return 0;
  const partialRefunds = o.payment?.refunds?.reduce((s, r) => s + r.amount, 0) ?? 0;
  return Math.max(0, o.total - partialRefunds);
};

export type DailyPoint = { date: string; label: string; revenue: number; orders: number; units: number };

export type MetricsRange = number | 'all';

export async function getMetrics(range: MetricsRange) {
  const [orders, customers, subscriptions, products, coupons, teamActive] = await Promise.all([
    readCollection<Order[]>('orders'),
    readCollection<Customer[]>('customers'),
    readCollection<Subscription[]>('subscriptions'),
    readCollection<Product[]>('products'),
    readCollection<Coupon[]>('coupons'),
    backendFetch('/api/v1/admin/team')
      .then(async (response) => {
        if (!response.ok) return 1;
        const body = await response.json() as { members?: { active: boolean }[] };
        return body.members?.filter((member) => member.active).length ?? 1;
      })
      .catch(() => 1),
  ]);

  const now = new Date();

  // Lifetime = from the first order (or first customer) to today.
  const isLifetime = range === 'all';
  let rangeDays: number;
  if (isLifetime) {
    const firstDates = [
      ...orders.map((o) => o.placedAt),
      ...customers.map((c) => c.joinedAt),
    ].sort();
    const first = firstDates[0] ? new Date(firstDates[0]) : now;
    rangeDays = Math.max(Math.ceil((now.getTime() - first.getTime()) / 86400_000) + 1, 7);
  } else {
    rangeDays = range;
  }
  const startOf = (daysBack: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysBack);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const rangeStart = startOf(rangeDays - 1);
  const prevStart = startOf(rangeDays * 2 - 1);

  const inRange = orders.filter((o) => new Date(o.placedAt) >= rangeStart);
  const inPrev = orders.filter((o) => {
    const t = new Date(o.placedAt);
    return t >= prevStart && t < rangeStart;
  });

  const revenue = inRange.reduce((s, o) => s + earned(o), 0);
  const prevRevenue = inPrev.reduce((s, o) => s + earned(o), 0);
  const orderCount = inRange.length;
  const prevOrderCount = inPrev.length;
  const unitsSold = inRange
    .filter(counted)
    .reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0);
  // Average order value over the orders that actually earned.
  const aov = Math.round(revenue / Math.max(inRange.filter((o) => earned(o) > 0).length, 1)) || 0;

  const newCustomers = customers.filter((c) => new Date(c.joinedAt) >= rangeStart).length;
  const prevNewCustomers = customers.filter((c) => {
    const t = new Date(c.joinedAt);
    return t >= prevStart && t < rangeStart;
  }).length;

  const trend = (cur: number, prev: number) =>
    prev === 0 ? (cur > 0 ? 100 : 0) : ((cur - prev) / prev) * 100;

  /* ------------------------------------------------------- daily series */
  const days: DailyPoint[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = startOf(i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      revenue: 0,
      orders: 0,
      units: 0,
    });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const o of inRange) {
    const day = byDate.get(o.placedAt.slice(0, 10));
    if (!day) continue;
    day.orders++;
    day.revenue += earned(o);
    if (counted(o)) {
      day.units += o.items.reduce((x, i) => x + i.quantity, 0);
    }
  }

  // Cumulative revenue across the range
  let running = 0;
  const cumulativeRevenue = days.map((d) => (running += d.revenue));

  // Weekly buckets (orders + new customers)
  const weekly: { label: string; orders: number; revenue: number }[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7);
    weekly.push({
      label: slice[0].label,
      orders: slice.reduce((s, d) => s + d.orders, 0),
      revenue: slice.reduce((s, d) => s + d.revenue, 0),
    });
  }

  /* -------------------------------------------------------- breakdowns */
  const countBy = <K extends string>(items: Order[], key: (o: Order) => K) => {
    const m = new Map<K, number>();
    for (const o of items) m.set(key(o), (m.get(key(o)) ?? 0) + 1);
    return m;
  };
  const statusCounts = countBy(inRange, (o) => o.status);
  const channelCounts = countBy(inRange, (o) => o.channel);
  const payMethodCounts = countBy(inRange.filter(counted), (o) => o.paymentMethod);

  /* ------------------------------------------------- attention queues */
  const toFulfil = orders.filter((o) => ['placed', 'confirmed', 'packed'].includes(o.status));
  const codPendingOrders = orders.filter(
    (o) => o.paymentMethod === 'cod' && o.paymentStatus === 'pending' && counted(o),
  );
  const refundsInRange = inRange.filter((o) => o.paymentStatus === 'refunded');
  const refundedAmount = refundsInRange.reduce((s, o) => s + o.total, 0);

  /* ----------------------------------------------------------- geography */
  const cityRevenue = new Map<string, { revenue: number; orders: number }>();
  for (const o of inRange.filter(counted)) {
    const cur = cityRevenue.get(o.address.city) ?? { revenue: 0, orders: 0 };
    cur.revenue += earned(o);
    cur.orders++;
    cityRevenue.set(o.address.city, cur);
  }
  const topCities = [...cityRevenue.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8);

  /* ------------------------------------------------------------- coupons */
  const couponUse = new Map<string, { uses: number; discount: number; revenue: number }>();
  for (const o of inRange.filter(counted)) {
    if (!o.couponCode) continue;
    const cur = couponUse.get(o.couponCode) ?? { uses: 0, discount: 0, revenue: 0 };
    cur.uses++;
    cur.discount += o.discount;
    cur.revenue += earned(o);
    couponUse.set(o.couponCode, cur);
  }
  const liveCoupons = coupons.filter(
    (c) =>
      c.active &&
      (!c.expiresAt || c.expiresAt > now.toISOString()) &&
      (c.usageLimit === null || c.usedCount < c.usageLimit),
  );

  /* ----------------------------------------------------------- customers */
  const customerOrderCounts = new Map<string, number>();
  for (const o of orders.filter(counted)) {
    customerOrderCounts.set(o.customerId, (customerOrderCounts.get(o.customerId) ?? 0) + 1);
  }
  const buyers = [...customerOrderCounts.values()];
  const repeatRate = buyers.length
    ? Math.round((buyers.filter((n) => n > 1).length / buyers.length) * 100)
    : 0;
  const topCustomers = [...customers]
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 6);

  /* -------------------------------------------------------------- stock */
  const stockAlerts = products.flatMap((p) =>
    p.tiers
      .filter((t) => t.available && t.stock <= t.lowStockAt)
      .map((t) => ({ productId: p.id, productName: p.name, tierName: t.name, stock: t.stock })),
  );

  /* ------------------------------------------------------------ weekday */
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekday = WEEKDAYS.map((label) => ({ label, orders: 0, revenue: 0 }));
  for (const o of inRange.filter(counted)) {
    const idx = (new Date(o.placedAt).getDay() + 6) % 7; // Mon = 0
    weekday[idx].orders++;
    weekday[idx].revenue += earned(o);
  }

  /* -------------------------------------------------------------- funnel */
  // How far the period's orders travelled through the pipeline.
  const reached = (stage: string) =>
    inRange.filter((o) => o.timeline.some((t) => t.stage === stage && t.at)).length;
  const funnel = [
    { label: 'Placed', value: inRange.length },
    { label: 'Confirmed', value: reached('confirmed') },
    { label: 'Packed', value: reached('packed') },
    { label: 'Shipped', value: reached('shipped') },
    { label: 'Delivered', value: reached('delivered') },
  ];

  /* -------------------------------------------- previous-period compare */
  const previous = {
    revenue: prevRevenue,
    orders: prevOrderCount,
    newCustomers: prevNewCustomers,
    aov: Math.round(prevRevenue / Math.max(inPrev.filter(counted).length, 1)) || 0,
  };

  // New customers per week (joinedAt) across the range
  const newCustomersWeekly = weekly.map((wk, i) => {
    const start = new Date(days[i * 7].date);
    const end = new Date(days[Math.min(i * 7 + 6, days.length - 1)].date);
    end.setHours(23, 59, 59, 999);
    return {
      label: wk.label,
      value: customers.filter((c) => {
        const t = new Date(c.joinedAt);
        return t >= start && t <= end;
      }).length,
    };
  });

  /* ------------------------------------------------------ subscriptions */
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const in7days = new Date(now);
  in7days.setDate(in7days.getDate() + 7);
  const upcomingDeliveries = activeSubs
    .filter((s) => s.nextDelivery && new Date(s.nextDelivery) <= in7days)
    .sort((a, b) => (a.nextDelivery! < b.nextDelivery! ? -1 : 1));

  return {
    orders,
    customers,
    products,
    coupons,
    subscriptions,
    isLifetime,
    rangeDays,
    kpis: {
      revenue,
      revenueTrend: trend(revenue, prevRevenue),
      orderCount,
      orderTrend: trend(orderCount, prevOrderCount),
      unitsSold,
      aov,
      newCustomers,
      customerTrend: trend(newCustomers, prevNewCustomers),
      activeSubscriptions: activeSubs.length,
      subscriptionMrr: activeSubs.reduce((s, x) => s + x.price, 0),
      toFulfil: toFulfil.length,
      codPending: codPendingOrders.length,
      codPendingAmount: codPendingOrders.reduce((s, o) => s + o.total, 0),
      refundedCount: refundsInRange.length,
      refundedAmount,
      repeatRate,
    },
    days,
    cumulativeRevenue,
    weekly,
    weekday,
    funnel,
    previous,
    newCustomersWeekly,
    statusCounts,
    channelCounts,
    payMethodCounts,
    topCities,
    couponUse,
    liveCoupons,
    topCustomers,
    stockAlerts,
    upcomingDeliveries,
    glance: {
      teamActive,
      productsActive: products.filter((p) => p.status === 'active').length,
      totalStock: products.reduce((s, p) => s + p.tiers.reduce((x, t) => x + t.stock, 0), 0),
      liveCouponCount: liveCoupons.length,
      pausedSubs: subscriptions.filter((s) => s.status === 'paused').length,
    },
    recentOrders: [...orders].sort((a, b) => (a.placedAt < b.placedAt ? 1 : -1)).slice(0, 7),
  };
}
