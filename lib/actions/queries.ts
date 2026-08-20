'use server';

import { revalidatePath } from 'next/cache';
import { readCollection, writeCollection } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import type { CustomerQuery, QueryStatus } from '@/lib/types';
import type { ActionResult } from './orders';
import { backendFetch } from '@/lib/backend';

// =========================================================
// Customer queries — the contact form's inbox.
//
// Replying is the one action that leaves the building: the
// answer is emailed to whoever asked, by the API. Everything
// else is bookkeeping.
// =========================================================

function touch(queryId: string) {
  revalidatePath('/queries');
  revalidatePath(`/queries/${queryId}`);
}

async function loadQuery(queryId: string) {
  const queries = await readCollection<CustomerQuery[]>('queries');
  const query = queries.find((q) => q.id === queryId);
  if (!query) throw new Error('Query not found.');
  return { queries, query };
}

/**
 * Answer a query. The API owns the reply because it owns the mailer — writing
 * the record here and emailing from somewhere else would let the two disagree
 * about whether the customer was ever actually told.
 */
export async function replyToQuery(
  queryId: string,
  reply: string,
  close: boolean,
): Promise<ActionResult> {
  const user = await assertPermission('queries.reply');
  const clean = reply.trim();
  if (clean.length < 2) return { ok: false, message: 'Write a reply first.' };

  let response: Response;
  try {
    response = await backendFetch(`/api/v1/admin/queries/${queryId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-actor-name': user.name,
      },
      body: JSON.stringify({ reply: clean, close }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, message: 'Can’t reach the API — the reply was not sent.' };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: body.message ?? 'The API refused that reply.' };
  }

  touch(queryId);
  return { ok: true, message: close ? 'Replied and closed.' : 'Reply sent to the customer.' };
}

export async function setQueryStatus(queryId: string, status: QueryStatus): Promise<ActionResult> {
  await assertPermission('queries.manage');
  const { queries, query } = await loadQuery(queryId);
  query.status = status;
  await writeCollection('queries', queries);
  touch(queryId);
  return { ok: true, message: `Marked ${status}.` };
}

export async function deleteQuery(queryId: string): Promise<ActionResult> {
  await assertPermission('queries.delete');
  const queries = await readCollection<CustomerQuery[]>('queries');
  const idx = queries.findIndex((q) => q.id === queryId);
  if (idx === -1) return { ok: false, message: 'Query not found.' };
  const [removed] = queries.splice(idx, 1);
  await writeCollection('queries', queries);
  revalidatePath('/queries');
  return { ok: true, message: `${removed.reference} deleted.` };
}
