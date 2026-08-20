'use client';

import { useState, useTransition } from 'react';
import { replyToQuery, setQueryStatus, deleteQuery } from '@/lib/actions/queries';
import type { ActionResult } from '@/lib/actions/orders';
import type { QueryStatus } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { useRouter } from 'next/navigation';

export function QueryActions({
  queryId,
  status,
  customerName,
  existingReply,
  canReply,
  canManage,
  canDelete,
}: {
  queryId: string;
  status: QueryStatus;
  customerName: string;
  existingReply: string;
  canReply: boolean;
  canManage: boolean;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const router = useRouter();
  const [reply, setReply] = useState('');

  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      try {
        const result = await fn();
        toast(result);
        if (result.ok) after?.();
      } catch (err) {
        toast({ ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' });
      }
    });

  if (!canReply && !canManage && !canDelete) {
    return (
      <div className="card">
        <h2 className="text-title mb-2">Actions</h2>
        <p className="text-body-sm text-fg-subtle">Your role can read this query but not act on it.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <h2 className="text-title">Reply</h2>

      {canReply ? (
        <>
          <p className="text-body-sm text-fg-muted">
            {existingReply
              ? `Already answered. Sending again emails ${customerName} a new reply.`
              : `This is emailed straight to ${customerName}, quoting the reference.`}
          </p>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={7}
            placeholder="Write the answer the customer will read…"
            className="field-input w-full resize-y"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || reply.trim().length < 2}
              onClick={() => run(() => replyToQuery(queryId, reply, false), () => setReply(''))}
              className="btn-accent"
            >
              Send reply
            </button>
            <button
              type="button"
              disabled={pending || reply.trim().length < 2}
              onClick={() => run(() => replyToQuery(queryId, reply, true), () => setReply(''))}
              className="btn-outline"
            >
              Send &amp; close
            </button>
          </div>
        </>
      ) : null}

      {canManage ? (
        <div className="border-t border-paper-200 pt-4">
          <p className="text-caption mb-2 text-fg-subtle">Status</p>
          <div className="flex flex-wrap gap-2">
            {(['new', 'open', 'answered', 'closed'] as QueryStatus[])
              .filter((s) => s !== status)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setQueryStatus(queryId, s))}
                  className="btn-outline"
                >
                  Mark {s}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {canDelete ? (
        <div className="border-t border-paper-200 pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete this query?',
                message: 'The question and any reply go for good. This cannot be undone.',
                confirmLabel: 'Delete',
                tone: 'danger',
              });
              if (ok) run(() => deleteQuery(queryId), () => router.push('/queries'));
            }}
            className="btn-danger"
          >
            Delete query
          </button>
        </div>
      ) : null}
    </div>
  );
}
