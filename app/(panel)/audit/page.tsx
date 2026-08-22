import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import { PageHeader, Table, Pill, EmptyState, td } from '@/components/ui';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';

export const metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; admin?: string; ok?: string; page?: string; per?: string };

type Entry = {
  _id: string;
  at: string;
  adminName: string;
  adminEmail: string;
  roleName: string;
  action: string;
  target: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  details: Record<string, unknown> | null;
  ip: string;
  durationMs: number;
  source?: string;
};

/**
 * Every change made through the panel, by whom, and whether it succeeded.
 * Super Admin only — the API refuses everyone else, and so does this page.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  if (!user.role.permissions.includes('*')) redirect('/');
  const params = await searchParams;

  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.admin) qs.set('admin', params.admin);
  if (params.ok === 'false') qs.set('ok', 'false');
  qs.set('page', params.page ?? '1');
  qs.set('per', params.per ?? '25');

  const response = await backendFetch(`/api/v1/admin/audit?${qs.toString()}`);
  const body = (await response.json().catch(() => ({}))) as {
    entries?: Entry[];
    admins?: { _id: string; name: string; count: number }[];
    page?: number;
    totalPages?: number;
    total?: number;
  };
  const entries = body.entries ?? [];
  const admins = body.admins ?? [];

  return (
    <>
      <PageHeader
        kicker="Admin"
        title="Audit log"
        description="Everything the team changed through the panel — who, what, when, and whether it went through. Kept for a year."
      />

      <FilterBar
        basePath="/audit"
        placeholder="Search actions, records, people…"
        filters={[
          {
            key: 'admin',
            label: 'Everyone',
            options: admins.map((a) => ({ value: a._id, label: `${a.name || a._id} (${a.count})` })),
          },
          { key: 'ok', label: 'All outcomes', options: [{ value: 'false', label: 'Failed only' }] },
        ]}
      />

      {entries.length === 0 ? (
        <EmptyState title="Nothing logged yet" hint="Changes made through the panel will appear here as they happen." />
      ) : (
        <Table head={['When', 'Who', 'Action', 'Record', 'Details', 'Result']}>
          {entries.map((e) => (
            <tr key={e._id} className="border-t border-paper-200 align-top">
              <td className={`${td} whitespace-nowrap text-fg-muted`}>
                {new Date(e.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                <span className="block text-[11px] text-fg-subtle">{e.ip}</span>
              </td>
              <td className={td}>
                <span className="block font-semibold">
                  {e.adminName || '—'}
                  {e.source === 'local' ? <Pill tone="warning">dev machine</Pill> : null}
                </span>
                <span className="block text-[11px] text-fg-subtle">{e.adminEmail}{e.roleName ? ` · ${e.roleName}` : ''}</span>
              </td>
              <td className={`${td} font-medium`}>{e.action}</td>
              <td className={`${td} font-mono text-[11.5px] text-fg-muted`}>{e.target || '—'}</td>
              <td className={`${td} max-w-[320px]`}>
                {e.details ? (
                  <details>
                    <summary className="cursor-pointer text-caption text-fg-muted hover:text-fg">
                      {Object.keys(e.details).slice(0, 3).join(', ')}
                      {Object.keys(e.details).length > 3 ? '…' : ''}
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-paper-100 p-2 font-mono text-[11px] text-fg">
                      {JSON.stringify(e.details, null, 1)}
                    </pre>
                  </details>
                ) : (
                  <span className="text-fg-subtle">—</span>
                )}
              </td>
              <td className={td}>
                <Pill tone={e.ok ? 'accent' : 'danger'}>{e.ok ? `OK ${e.status}` : `Failed ${e.status}`}</Pill>
                <span className="mt-1 block text-[11px] text-fg-subtle">{e.durationMs} ms</span>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Pagination basePath="/audit" page={body.page ?? 1} totalPages={body.totalPages ?? 1} total={body.total ?? 0} noun="entries" />
    </>
  );
}
