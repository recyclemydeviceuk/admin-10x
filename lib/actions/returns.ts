'use server';

import { revalidatePath } from 'next/cache';
import { readCollection, writeCollection } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';
import type { ReturnRequest } from '@/lib/types';
import type { ActionResult } from './orders';

async function loadReturn(returnId: string) {
  const returns = await readCollection<ReturnRequest[]>('returns');
  const ret = returns.find((r) => r.id === returnId);
  if (!ret) throw new Error('Return request not found.');
  return { returns, ret };
}

function touch(returnId: string) {
  revalidatePath('/returns');
  revalidatePath(`/returns/${returnId}`);
  revalidatePath('/');
}

async function backendReturnAction(
  returnId: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<ActionResult> {
  const response = await backendFetch(`/api/v1/admin/returns/${returnId}/${action}`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
  if (!response.ok) {
    return { ok: false, message: data.error?.message ?? data.message ?? `Backend request failed (${response.status}).` };
  }
  touch(returnId);
  return { ok: true, message: data.message ?? 'Done.' };
}

/**
 * Accept the return: Shiprocket books a reverse pickup from the customer's
 * address and delivers to the environment-configured warehouse.
 */
export async function approveReturn(
  returnId: string,
  pickup: 'shiprocket' | 'manual' = 'shiprocket',
): Promise<ActionResult> {
  await assertPermission('returns.approve');
  const result = await backendReturnAction(returnId, 'approve', { pickup });
  return result.ok
    ? {
        ok: true,
        message:
          pickup === 'shiprocket'
            ? 'Return approved — Shiprocket will pick up from the customer and deliver to the warehouse.'
            : 'Return approved — arrange the pickup with the customer yourself; no courier was booked.',
      }
    : result;
}

export async function rejectReturn(returnId: string, reason: string): Promise<ActionResult> {
  const user = await assertPermission('returns.reject');
  const clean = reason.trim();
  if (!clean) return { ok: false, message: 'Tell the customer why — the reason is shown to them.' };

  const { returns, ret } = await loadReturn(returnId);
  if (ret.status !== 'requested') return { ok: false, message: 'Only requested returns can be rejected.' };

  const now = new Date().toISOString();
  ret.status = 'rejected';
  ret.rejectReason = clean;
  ret.resolvedAt = now;
  ret.notes.push({ by: user.name, at: now, text: `Rejected: ${clean}` });

  await writeCollection('returns', returns);
  touch(returnId);
  return { ok: true, message: `${ret.reference} rejected.` };
}

/** The parcel arrived at the warehouse — unlocks the refund step. */
export async function markReturnReceived(returnId: string): Promise<ActionResult> {
  const user = await assertPermission('returns.receive');
  const { returns, ret } = await loadReturn(returnId);
  if (ret.status !== 'approved') return { ok: false, message: 'Approve the return (and wait for pickup) first.' };

  const now = new Date().toISOString();
  ret.status = 'received';
  ret.notes.push({ by: user.name, at: now, text: 'Parcel received at the warehouse.' });

  await writeCollection('returns', returns);
  touch(returnId);
  return { ok: true, message: 'Marked received — you can issue the refund now.' };
}

/**
 * Refund the customer. Prepaid → Cashfree refund API against the original
 * payment; COD → recorded as a manual payout (Cashfree never held the money).
 */
export async function refundReturn(returnId: string): Promise<ActionResult> {
  await assertPermission('returns.refund');
  const result = await backendReturnAction(returnId, 'refund');
  if (!result.ok) return result;
  revalidatePath('/orders');
  revalidatePath('/transactions');
  return { ok: true, message: 'Refund recorded through the backend.' };
}

export async function addReturnNote(returnId: string, text: string): Promise<ActionResult> {
  const user = await assertPermission('returns.notes');
  const clean = text.trim();
  if (!clean) return { ok: false, message: 'Write a note first.' };
  const { returns, ret } = await loadReturn(returnId);
  ret.notes.push({ by: user.name, at: new Date().toISOString(), text: clean });
  await writeCollection('returns', returns);
  touch(returnId);
  return { ok: true, message: 'Note added.' };
}
