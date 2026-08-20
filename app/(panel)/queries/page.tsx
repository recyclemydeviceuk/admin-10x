import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { paginate, parseSort, matchesDate } from '@/lib/list';
import {
  QUERY_STATUSES,
  QUERY_STATUS_LABEL,
  QUERY_TOPICS,
  queryTopicLabel,
  type CustomerQuery,
  type QueryStatus,
} from '@/lib/types';
import { PageHeader, Table, Pill, EmptyState, Avatar, DateCell, td } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { SortHeader } from '@/components/list/SortHeader';

export const metadata = { title: 'Queries' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; status?: string; topic?: string; date?: string; sort?: string; page?: string; per?: string };

const STATUS_TONE: Record<QueryStatus, 'neutral' | 'accent' | 'warning' | 'danger'> = {
  new: 'warning',
  open: 'accent',
  answered: 'accent',
  closed: 'neutral',
};

export default async function QueriesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission('queries.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let queries = await readCollection<CustomerQuery[]>('queries');
  if (params.status) queries = queries.filter((item) => item.status === params.status);
  if (params.topic) queries = queries.filter((item) => item.topic === params.topic);
  if (params.date) queries = queries.filter((item) => matchesDate(item.submittedAt, params.date));
  if (q) {
    queries = queries.filter(
      (item) =>
        item.reference.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q) ||
        item.orderReference.toLowerCase().includes(q),
    );
  }

  const [sortField, dir] = parseSort(params.sort, 'submittedAt');
  queries.sort((a, b) => {
    const av = sortField === 'name' ? a.name.toLowerCase() : a.submittedAt;
    const bv = sortField === 'name' ? b.name.toLowerCase() : b.submittedAt;
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  const { pageItems, page, totalPages, total } = paginate(queries, params.page, params.per);

  return (
    <>
      <PageHeader kicker="Store" title="Queries" />

      <FilterBar
        basePath="/queries"
        placeholder="Search reference, name, email, message…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: QUERY_STATUSES.map((s) => ({ value: s, label: QUERY_STATUS_LABEL[s] })),
          },
          {
            key: 'topic',
            label: 'Topic',
            options: QUERY_TOPICS.map((t) => ({ value: t.value, label: t.label })),
          },
        ]}
        withDate
        dateLabel="Received"
      />

      {pageItems.length === 0 ? (
        <EmptyState
          title="No queries match"
          hint="Questions sent from the website's contact form land here."
        />
      ) : (
        <Table
          head={[
            <SortHeader key="n" basePath="/queries" field="name">Who</SortHeader>,
            'Topic',
            'Message',
            'Order',
            'Status',
            <SortHeader key="d" basePath="/queries" field="submittedAt">Received</SortHeader>,
            <span key="x" className="block text-right">Actions</span>,
          ]}
        >
          {pageItems.map((item, i) => (
            <tr key={item.id} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <Link href={`/queries/${item.id}`} className="flex items-center gap-2.5">
                  <Avatar name={item.name} seed={i} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-semibold hover:text-accent-pressed">{item.name}</span>
                    <span className="block truncate text-[11px] text-fg-subtle">{item.email}</span>
                  </span>
                </Link>
              </td>
              <td className={`${td} text-fg-muted`}>{queryTopicLabel(item.topic)}</td>
              <td className={`${td} max-w-sm`}>
                <span className="block truncate text-fg-muted">{item.message}</span>
                <span className="block text-[11px] text-fg-subtle">{item.reference}</span>
              </td>
              <td className={`${td} text-fg-muted`}>{item.orderReference || '—'}</td>
              <td className={td}>
                <Pill tone={STATUS_TONE[item.status]}>{QUERY_STATUS_LABEL[item.status]}</Pill>
              </td>
              <td className={td}><DateCell iso={item.submittedAt} /></td>
              <td className={td}>
                <div className="flex items-center justify-end">
                  <Link
                    href={`/queries/${item.id}`}
                    title="Open query"
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

      <Pagination basePath="/queries" page={page} totalPages={totalPages} total={total} noun="queries" />
    </>
  );
}
