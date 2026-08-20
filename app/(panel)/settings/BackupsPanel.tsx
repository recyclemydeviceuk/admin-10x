'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runBackupNow, type BackupStatus, type BackupRecordView } from '@/lib/actions/backups';
import { Table, Pill, EmptyState, DateCell } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';

const fmtBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : n > 0 ? `${Math.ceil(n / 1024)} KB` : '—';

const STATUS_TONE: Record<BackupRecordView['status'], { label: string; tone: 'accent' | 'warning' | 'danger' }> = {
  success: { label: 'Success', tone: 'accent' },
  partial: { label: 'Partial', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
};

export function BackupsPanel({ status, canRun }: { status: BackupStatus | null; canRun: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  if (!status) {
    return (
      <EmptyState
        title="The backend is not reachable"
        hint="Start the API server (server/ — npm run dev, port 4000), then refresh. Backups run inside the backend, next to the database."
      />
    );
  }

  const { config } = status;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-title">Daily database backup</h2>
            <p className="mt-1 text-body-sm text-fg-muted">
              Every collection, one encrypted-transit archive, dropped into
              {config.buckets.length > 1 ? ` ${config.buckets.length} buckets` : ' the backup bucket'} and pruned after{' '}
              {config.retentionDays} days.
            </p>
          </div>
          {canRun ? (
            <button
              type="button"
              className="btn-accent shrink-0"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  toast(await runBackupNow());
                  router.refresh();
                })
              }
            >
              <Icon name="database" className="h-4 w-4" />
              {pending ? 'Backing up…' : 'Back up now'}
            </button>
          ) : null}
        </div>

        <dl className="mt-5 grid gap-4 border-t border-paper-200 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-caption font-medium text-fg-subtle">Schedule</dt>
            <dd className="mt-0.5 text-body-sm font-semibold">
              {config.enabled ? `Daily at ${String(config.hourIst).padStart(2, '0')}:00 IST` : 'Off'}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-fg-subtle">Last successful backup</dt>
            <dd className="mt-0.5 text-body-sm font-semibold">
              {status.lastSuccessAt
                ? new Date(status.lastSuccessAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
                : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-fg-subtle">Destinations</dt>
            <dd className="mt-0.5 text-body-sm font-semibold">
              {config.buckets.length > 0 ? config.buckets.join(' · ') : 'None set'}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium text-fg-subtle">Storage</dt>
            <dd className="mt-0.5">
              <Pill tone={config.s3Ready ? 'accent' : 'neutral'}>{config.s3Ready ? 'S3 ready' : 'S3 not configured'}</Pill>
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-caption text-fg-subtle">
          The schedule, destination, retention, and AWS credentials are protected in the backend environment.
        </p>
      </div>

      {/* History */}
      {status.records.length === 0 ? (
        <EmptyState title="No backups yet" hint="Run the first one with the button above once S3 is configured." />
      ) : (
        <Table head={['When', 'Result', 'Size', 'Contents', 'Buckets', 'Pruned']}>
          {status.records.map((r) => (
            <tr key={r.id} className="hover:bg-accent-soft/40">
              <td className="whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 align-middle">
                <DateCell iso={r.startedAt} />
                <p className="text-caption text-fg-subtle">{r.trigger === 'manual' ? `manual · ${r.by || 'admin'}` : 'scheduled'}</p>
              </td>
              <td className="px-3 py-2.5 first:pl-4 last:pr-4 align-middle">
                <Pill tone={STATUS_TONE[r.status].tone}>{STATUS_TONE[r.status].label}</Pill>
                {r.error ? <p className="mt-1 max-w-56 text-caption text-fg-subtle">{r.error}</p> : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 align-middle tabular-nums">{fmtBytes(r.sizeBytes)}</td>
              <td className="whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 align-middle text-fg-muted">
                {r.collectionCount > 0 ? `${r.collectionCount} collections · ${r.documentCount} docs` : '—'}
              </td>
              <td className="px-3 py-2.5 first:pl-4 last:pr-4 align-middle">
                {r.destinations.length > 0 ? (
                  <div className="space-y-0.5">
                    {r.destinations.map((d) => (
                      <p key={d.bucket} className="flex items-center gap-1.5 text-caption">
                        <span className={`h-1.5 w-1.5 rounded-full ${d.ok ? 'bg-accent-pressed' : 'bg-danger'}`} />
                        <span className="font-mono">{d.bucket}</span>
                        {!d.ok && d.error ? <span className="text-fg-subtle">— {d.error}</span> : null}
                      </p>
                    ))}
                  </div>
                ) : (
                  <span className="text-caption text-fg-subtle">—</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4 align-middle tabular-nums text-fg-muted">
                {r.prunedCount > 0 ? r.prunedCount : '—'}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
