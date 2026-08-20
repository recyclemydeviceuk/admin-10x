import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr, fmtDateTime } from '@/lib/format';
import { RETURN_STATUS_LABEL, type ReturnRequest, type ReturnStatus } from '@/lib/types';
import { PageHeader, Pill, BackLink } from '@/components/ui';
import { ReturnActions } from './ReturnActions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<ReturnStatus, 'neutral' | 'accent' | 'warning' | 'danger'> = {
  requested: 'warning',
  approved: 'accent',
  received: 'accent',
  refunded: 'neutral',
  rejected: 'danger',
};

const FLOW: ReturnStatus[] = ['requested', 'approved', 'received', 'refunded'];

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('returns.view');
  const { id } = await params;

  const returns = await readCollection<ReturnRequest[]>('returns');
  const ret = returns.find((r) => r.id === id);
  if (!ret) notFound();

  const stageIdx = ret.status === 'rejected' ? -1 : FLOW.indexOf(ret.status);

  return (
    <>
      <BackLink href="/returns" label="All returns" />
      <PageHeader
        kicker={`Requested ${fmtDateTime(ret.requestedAt)}`}
        title={ret.reference}
        actions={<Pill tone={STATUS_TONE[ret.status]}>{RETURN_STATUS_LABEL[ret.status]}</Pill>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Progress */}
          {ret.status !== 'rejected' ? (
            <div className="card">
              <ol className="flex flex-wrap items-center gap-2">
                {FLOW.map((stage, i) => (
                  <li key={stage} className="flex items-center gap-2">
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium ${
                        i <= stageIdx ? 'bg-accent/20 text-accent-pressed' : 'bg-paper-100 text-fg-subtle'
                      }`}
                    >
                      {RETURN_STATUS_LABEL[stage]}
                    </span>
                    {i < FLOW.length - 1 ? <span className="text-fg-subtle">→</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="card border-danger/30">
              <p className="text-body-sm font-semibold text-danger">Rejected</p>
              <p className="mt-1 text-body-sm text-fg-muted">{ret.rejectReason}</p>
            </div>
          )}

          {/* Customer's case */}
          <div className="card">
            <h2 className="text-title mb-3">Why the customer wants to return</h2>
            <Pill tone="neutral">{ret.reason}</Pill>
            <p className="mt-3 text-body leading-relaxed text-fg-muted">{ret.description}</p>

            {ret.photos.length > 0 ? (
              <div className="mt-5 border-t border-paper-200 pt-4">
                <p className="field-label">Photos from the customer</p>
                <div className="flex flex-wrap gap-3">
                  {ret.photos.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" className="group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt="Customer return photo"
                        className="h-32 w-32 rounded-lg border border-paper-200 object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Notes */}
          {ret.notes.length > 0 ? (
            <div className="card">
              <h2 className="text-title mb-4">Activity</h2>
              <ul className="space-y-3">
                {[...ret.notes].reverse().map((n, i) => (
                  <li key={i} className="border-l-2 border-paper-300 pl-3">
                    <p className="text-body-sm">{n.text}</p>
                    <p className="mt-0.5 text-caption text-fg-subtle">
                      {n.by} · {fmtDateTime(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <ReturnActions
            returnId={ret.id}
            status={ret.status}
            amount={ret.amount}
            isPrepaid={ret.paymentMethod === 'online'}
            canApprove={can(user, 'returns.approve')}
            canReject={can(user, 'returns.reject')}
            canReceive={can(user, 'returns.receive')}
            canRefund={can(user, 'returns.refund')}
            canNotes={can(user, 'returns.notes')}
          />

          <div className="card">
            <h2 className="text-title mb-3">Order & customer</h2>
            <dl className="space-y-1.5 text-body-sm">
              <div className="flex justify-between">
                <dt className="text-fg-muted">Order</dt>
                <dd>
                  <Link href={`/orders/${ret.orderId}`} className="font-medium hover:text-accent-pressed">
                    {ret.orderReference}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Customer</dt>
                <dd className="font-medium">{ret.customerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Email</dt>
                <dd className="truncate">{ret.customerEmail}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Refund amount</dt>
                <dd className="font-semibold">{inr(ret.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-fg-muted">Paid via</dt>
                <dd className="uppercase">{ret.paymentMethod === 'online' ? 'Cashfree' : 'COD'}</dd>
              </div>
            </dl>
          </div>

          {ret.pickup ? (
            <div className="card">
              <h2 className="text-title mb-3">Reverse pickup</h2>
              <dl className="space-y-1.5 text-body-sm">
                {ret.pickup.shipmentId ? (
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Shiprocket shipment</dt>
                    <dd className="font-mono text-caption">{ret.pickup.shipmentId}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Courier</dt>
                  <dd>{ret.pickup.courier ?? 'Assigning…'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">AWB</dt>
                  <dd className="font-mono text-caption">{ret.pickup.awb ?? 'Pending'}</dd>
                </div>
                {ret.pickup.scheduledAt ? (
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Booked</dt>
                    <dd>{fmtDateTime(ret.pickup.scheduledAt)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}

          {ret.refund ? (
            <div className="card">
              <h2 className="text-title mb-3">Refund</h2>
              <dl className="space-y-1.5 text-body-sm">
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Amount</dt>
                  <dd className="font-semibold">{inr(ret.amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Mode</dt>
                  <dd>{ret.refund.mode === 'cashfree' ? 'Cashfree — original payment method' : 'Manual payout (COD)'}</dd>
                </div>
                {ret.refund.refundId ? (
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Refund id</dt>
                    <dd className="font-mono text-caption">{ret.refund.refundId}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-fg-muted">Issued</dt>
                  <dd>{fmtDateTime(ret.refund.at)}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
