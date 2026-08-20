import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { fmtDateTime } from '@/lib/format';
import {
  QUERY_STATUS_LABEL,
  queryTopicLabel,
  type CustomerQuery,
  type Order,
  type QueryStatus,
} from '@/lib/types';
import { PageHeader, Pill, BackLink } from '@/components/ui';
import { QueryActions } from './QueryActions';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<QueryStatus, 'neutral' | 'accent' | 'warning' | 'danger'> = {
  new: 'warning',
  open: 'accent',
  answered: 'accent',
  closed: 'neutral',
};

export default async function QueryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('queries.view');
  const { id } = await params;

  const queries = await readCollection<CustomerQuery[]>('queries');
  const query = queries.find((q) => q.id === id);
  if (!query) notFound();

  // If they quoted an order, link straight to it — the answer is usually there.
  const orders = query.orderReference ? await readCollection<Order[]>('orders') : [];
  const order = orders.find((o) => o.reference.toLowerCase() === query.orderReference.toLowerCase()) ?? null;

  return (
    <>
      <BackLink href="/queries" label="All queries" />
      <PageHeader
        kicker={`Received ${fmtDateTime(query.submittedAt)}`}
        title={query.reference}
        actions={<Pill tone={STATUS_TONE[query.status]}>{QUERY_STATUS_LABEL[query.status]}</Pill>}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <h2 className="text-title mb-1">{queryTopicLabel(query.topic)}</h2>
            <p className="text-caption mb-4 text-fg-subtle">
              {query.name} · {query.email}
              {query.phone ? ` · ${query.phone}` : ''}
            </p>
            <p className="whitespace-pre-wrap text-body text-fg">{query.message}</p>
          </div>

          {query.reply ? (
            <div className="card">
              <h2 className="text-title mb-1">Our reply</h2>
              <p className="text-caption mb-4 text-fg-subtle">
                {query.answeredBy || 'The team'}
                {query.answeredAt ? ` · ${fmtDateTime(query.answeredAt)}` : ''}
              </p>
              <p className="whitespace-pre-wrap text-body text-fg">{query.reply}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <QueryActions
            queryId={query.id}
            status={query.status}
            customerName={query.name}
            existingReply={query.reply}
            canReply={can(user, 'queries.reply')}
            canManage={can(user, 'queries.manage')}
            canDelete={can(user, 'queries.delete')}
          />

          <div className="card">
            <h2 className="text-title mb-3">Context</h2>
            <dl className="space-y-2.5 text-body-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Topic</dt>
                <dd className="text-right font-medium">{queryTopicLabel(query.topic)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Email</dt>
                <dd className="text-right font-medium break-all">{query.email}</dd>
              </div>
              {query.phone ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-subtle">Phone</dt>
                  <dd className="text-right font-medium">{query.phone}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Order</dt>
                <dd className="text-right font-medium">
                  {order ? (
                    <Link href={`/orders/${order.id}`} className="hover:text-accent-pressed">
                      {order.reference}
                    </Link>
                  ) : (
                    query.orderReference || '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </>
  );
}
