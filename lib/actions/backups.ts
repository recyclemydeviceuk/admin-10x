'use server';

import { assertPermission } from '@/lib/auth';
import type { ActionResult } from './orders';
import { backendFetch } from '@/lib/backend';

// Proxy the authenticated admin's request to the backend backup API.

export type BackupDestination = { bucket: string; key: string; ok: boolean; error: string };

export type BackupRecordView = {
  id: string;
  status: 'success' | 'partial' | 'failed';
  trigger: 'schedule' | 'manual';
  startedAt: string;
  durationMs: number;
  sizeBytes: number;
  collectionCount: number;
  documentCount: number;
  destinations: BackupDestination[];
  prunedCount: number;
  error: string;
  by: string;
};

export type BackupStatus = {
  config: {
    enabled: boolean;
    hourIst: number;
    retentionDays: number;
    buckets: string[];
    s3Ready: boolean;
  };
  lastSuccessAt: string | null;
  records: BackupRecordView[];
};

async function proxy(path: string, actorName: string, init?: RequestInit) {
  try {
    const res = await backendFetch(`/api/v1/admin/backups${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-actor-name': actorName,
        ...init?.headers,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** null = backend offline. */
export async function fetchBackupStatus(): Promise<BackupStatus | null> {
  const user = await assertPermission('settings.backups');
  const body = await proxy('', user.name);
  if (!body) return null;
  return body as unknown as BackupStatus;
}

export async function runBackupNow(): Promise<ActionResult> {
  const user = await assertPermission('settings.backups');
  try {
    const res = await backendFetch('/api/v1/admin/backups/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor-name': user.name },
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    return { ok: Boolean(body.ok), message: String(body.message ?? 'Backup finished.') };
  } catch {
    return { ok: false, message: 'Backend not reachable — start the API server first.' };
  }
}
