import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr, fmtDateTime, fmtDate } from '@/lib/format';
import { STAGE_LABEL, type Order, type Product, type Settings } from '@/lib/types';
import { PageHeader, OrderStatusBadge, PaymentBadge, BackLink, Avatar, ProductThumb } from '@/components/ui';
import { productImageFor } from '@/lib/productImage';
import { Icon } from '@/components/Icon';
import { OrderActions, FulfilmentPanel } from './OrderActions';
import { PaymentActions } from './PaymentActions';

export const dynamic = 'force-dynamic';

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">{label}</p>
      <div className="mt-1 truncate text-body font-semibold">{value}</div>
      {sub ? <p className="truncate text-caption text-fg-subtle">{sub}</p> : null}
    </div>
  );
}

function Row({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-body-sm text-fg-muted">{label}</dt>
      <dd className={`min-w-0 truncate text-right text-body-sm font-medium ${mono ? 'font-mono text-caption' : ''}`}>
        {children}
      </dd>
    </div>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('orders.view');
  const { id } = await params;

  const [orders, settings, products] = await Promise.all([
    readCollection<Order[]>('orders'),
    readCollection<Settings>('settings'),
    readCollection<Product[]>('products'),
  ]);
  const order = orders.find((o) => o.id === id);
  if (!order) notFound();

  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  const isCashfree = order.payment?.provider === 'cashfree';

  return (
    <>
      <BackLink href="/orders" label="All orders" />
      <PageHeader
        kicker={`Placed ${fmtDateTime(order.placedAt)}`}
        title={order.reference}
        actions={
          <div className="flex items-center gap-2">
            <PaymentBadge status={order.paymentStatus} />
            <OrderStatusBadge status={order.status} />
          </div>
        }
      />

      {/* At-a-glance strip */}
      <div className="card mb-6 grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Total" value={inr(order.total)} sub={`${units} × ${order.items[0]?.packets}`} />
        <Fact
          label="Payment"
          value={isCashfree ? `Cashfree · ${(order.payment?.method ?? 'online').toUpperCase()}` : 'Cash on delivery'}
        />
        <Fact
          label="Type"
          value={order.channel === 'subscription' ? 'Subscription cycle' : 'One-time purchase'}
        />
        <Fact
          label="Ship to"
          value={order.address.city}
          sub={`${order.address.state} ${order.address.pincode}`}
        />
        <Fact
          label={order.status === 'delivered' ? 'Delivered' : 'ETA'}
          value={
            order.status === 'delivered'
              ? fmtDate(order.timeline.find((t) => t.stage === 'delivered')?.at ?? null)
              : order.estimatedDelivery
                ? fmtDate(order.estimatedDelivery)
                : '—'
          }
          sub={order.courier ? `${order.courier}` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------------------------------ left: the story */}
        <div className="space-y-6 lg:col-span-2">
          {/* Items */}
          <div className="card p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-title">Items</h2>
              <span className="text-caption text-fg-subtle">{units} unit{units === 1 ? '' : 's'}</span>
            </div>
            <div className="divide-y divide-paper-200 border-t border-paper-200">
              {order.items.map((item) => (
                <div key={item.sku} className="flex items-center gap-3 px-5 py-3.5">
                  <ProductThumb src={productImageFor(products, item)} name={item.name} size="md" />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-body font-semibold">{item.name}</p>
                    <p className="text-caption text-fg-subtle">{item.packets} · {item.sku}</p>
                  </div>
                  <p className="shrink-0 text-body-sm text-fg-muted">{item.quantity} × {inr(item.price)}</p>
                  <p className="w-20 shrink-0 text-right text-body font-semibold">{inr(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <dl className="space-y-0.5 border-t border-paper-200 bg-paper-100/50 px-5 py-4">
              <Row label="Subtotal">{inr(order.subtotal)}</Row>
              {order.discount > 0 ? (
                <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ''}`}>
                  <span className="text-accent-pressed">−{inr(order.discount)}</span>
                </Row>
              ) : null}
              <Row label="Shipping">{order.shipping === 0 ? 'Free' : inr(order.shipping)}</Row>
              <div className="mt-1 flex items-baseline justify-between border-t border-paper-200 pt-2.5">
                <dt className="text-body font-semibold">Total</dt>
                <dd className="brand-head text-[1.25rem]">{inr(order.total)}</dd>
              </div>
            </dl>
          </div>

          {/* Journey */}
          <div className="card">
            <h2 className="text-title mb-5">Journey</h2>
            <ol className="space-y-0">
              {order.timeline.map((e, i) => (
                <li key={e.stage} className="relative flex gap-3.5 pb-4 last:pb-0">
                  {i < order.timeline.length - 1 ? (
                    <span className={`absolute left-[9px] top-5 h-full w-0.5 rounded ${e.at ? 'bg-accent' : 'bg-paper-200'}`} />
                  ) : null}
                  <span
                    className={`relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      e.at ? 'bg-accent text-accent-ink' : 'border-2 border-paper-300 bg-white'
                    }`}
                  >
                    {e.at ? <Icon name="check" className="h-3 w-3" /> : null}
                  </span>
                  <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <p className={`text-body-sm ${e.at ? 'font-semibold' : 'text-fg-subtle'}`}>{STAGE_LABEL[e.stage]}</p>
                    <p className="shrink-0 text-caption text-fg-subtle">{e.at ? fmtDateTime(e.at) : ''}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Activity */}
          {order.notes && order.notes.length > 0 ? (
            <div className="card">
              <h2 className="text-title mb-4">Activity & notes</h2>
              <ul className="space-y-3">
                {[...order.notes].reverse().map((n, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        n.by === 'Automation' || n.by === 'Sync' ? 'bg-ink text-accent' : 'bg-accent-soft text-accent-pressed'
                      }`}
                    >
                      {n.by === 'Automation' || n.by === 'Sync' ? 'S' : n.by.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-sm">{n.text}</p>
                      <p className="text-caption text-fg-subtle">{n.by === 'Automation' ? 'Sync' : n.by} · {fmtDateTime(n.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* --------------------------------------------- right: act & info */}
        <div className="space-y-6">
          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.paymentStatus}
            canStatus={can(user, 'orders.status')}
            canRefund={can(user, 'orders.refund')}
            canNotes={can(user, 'orders.notes')}
            canDelete={can(user, 'orders.delete')}
          />

          <FulfilmentPanel
            orderId={order.id}
            shipment={order.shipment}
            courier={order.courier}
            trackingNumber={order.trackingNumber}
            canFulfil={can(user, 'fulfilment.create')}
            canManual={can(user, 'fulfilment.manual')}
            autoShipments={settings.syncing?.autoShipments ?? false}
          />

          {/* Customer */}
          <div className="card">
            <h2 className="text-title mb-4">Customer</h2>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={order.customerName} />
              <div className="min-w-0 leading-tight">
                {can(user, 'customers.view') ? (
                  <Link href={`/customers/${order.customerId}`} className="block truncate text-body font-semibold hover:text-accent-pressed">
                    {order.customerName}
                  </Link>
                ) : (
                  <p className="truncate text-body font-semibold">{order.customerName}</p>
                )}
                <p className="truncate text-caption text-fg-subtle">{order.customerEmail}</p>
              </div>
            </div>
            <dl>
              <Row label="Phone">{order.address.phone}</Row>
              <Row label="Address">
                {order.address.house}, {order.address.street}
              </Row>
              <Row label="City">
                {order.address.city}, {order.address.state} {order.address.pincode}
              </Row>
            </dl>
          </div>

          {/* Payment */}
          <div className="card">
            <h2 className="text-title mb-3">Payment</h2>
            <dl>
              <Row label="Method">{isCashfree ? `Cashfree · ${order.payment?.method ?? 'online'}` : 'Cash on delivery'}</Row>
              {order.payment?.cfPaymentId ? <Row label="Payment id" mono>{order.payment.cfPaymentId}</Row> : null}
              {order.invoiceNo ? <Row label="Invoice" mono>{order.invoiceNo}</Row> : null}
              {order.payment?.refunds?.map((r) => (
                <Row key={r.refundId} label={`Refund ${r.refundId}`}>
                  <span className="text-danger">−{inr(r.amount)}</span>
                </Row>
              ))}
            </dl>
            <PaymentActions orderId={order.id} canInvoice={can(user, 'orders.invoice')} />
          </div>

          {/* Shipment */}
          {order.shipment?.shipmentId || order.trackingNumber ? (
            <div className="card">
              <h2 className="text-title mb-3">Shipment</h2>
              <dl>
                <Row label="Courier">{order.shipment?.courier ?? order.courier ?? 'Assigning…'}</Row>
                <Row label="AWB" mono>{order.shipment?.awb ?? order.trackingNumber ?? 'Pending'}</Row>
                {order.shipment?.status ? <Row label="Courier status">{order.shipment.status}</Row> : null}
                {order.shipment?.pickupRequestedAt ? (
                  <Row label="Pickup requested">{fmtDateTime(order.shipment.pickupRequestedAt)}</Row>
                ) : null}
                {order.shipment?.lastSyncedAt ? <Row label="Last synced">{fmtDateTime(order.shipment.lastSyncedAt)}</Row> : null}
              </dl>
              {order.shipment?.labelUrl || order.shipment?.invoiceUrl ? (
                <div className="mt-3 flex gap-2 border-t border-paper-200 pt-3">
                  {order.shipment.labelUrl ? (
                    <a href={order.shipment.labelUrl} target="_blank" rel="noreferrer" className="btn-outline flex-1 px-3 py-2 text-caption">
                      Label PDF
                    </a>
                  ) : null}
                  {order.shipment.invoiceUrl ? (
                    <a href={order.shipment.invoiceUrl} target="_blank" rel="noreferrer" className="btn-outline flex-1 px-3 py-2 text-caption">
                      Shiprocket invoice
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
