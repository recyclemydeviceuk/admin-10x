'use client';

import { useState, useTransition } from 'react';
import {
  approveReturn,
  rejectReturn,
  markReturnReceived,
  refundReturn,
  addReturnNote,
} from '@/lib/actions/returns';
import type { ActionResult } from '@/lib/actions/orders';
import type { ReturnStatus } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';

export function ReturnActions({
  returnId,
  status,
  amount,
  isPrepaid,
  canApprove,
  canReject,
  canReceive,
  canRefund,
  canNotes,
}: {
  returnId: string;
  status: ReturnStatus;
  amount: number;
  isPrepaid: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReceive: boolean;
  canRefund: boolean;
  canNotes: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm, prompt } = useConfirm();
  const [note, setNote] = useState('');

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        toast(await fn());
      } catch (err) {
        toast({ ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' });
      }
    });

  if (!canApprove && !canReject && !canReceive && !canRefund && !canNotes) {
    return (
      <div className="card">
        <h2 className="text-title mb-2">Actions</h2>
        <p className="text-body-sm text-fg-subtle">Your role can view this return but not act on it.</p>
      </div>
    );
  }

  const rupees = `₹${amount.toLocaleString('en-IN')}`;

  return (
    <div className="card space-y-4">
      <h2 className="text-title">Next step</h2>

      {status === 'requested' ? (
        <>
          <p className="text-body-sm text-fg-muted">
            Review the reason and photos. Approving books a Shiprocket pickup from the customer's address to the warehouse.
          </p>
          <div className="grid gap-2">
            {canApprove ? (
            <button
              type="button"
              className="btn-accent justify-start"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Approve this return?',
                  message: 'Shiprocket books a reverse pickup from the customer and delivers to your warehouse. The refund happens after the parcel arrives.',
                  confirmLabel: 'Approve return',
                  tone: 'accent',
                });
                if (ok) run(() => approveReturn(returnId, 'shiprocket'));
              }}
            >
              <Icon name="truck" className="h-4 w-4" />
              {pending ? 'Working…' : 'Approve — book pickup'}
            </button>
            ) : null}
            {canApprove ? (
            <button
              type="button"
              className="btn-outline justify-start"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Approve without booking a courier?',
                  message: 'The return is approved but NO pickup is booked — you arrange collection with the customer yourself. Use this when Shiprocket isn’t set up or the parcel is coming back another way.',
                  confirmLabel: 'Approve — manual pickup',
                  tone: 'accent',
                });
                if (ok) run(() => approveReturn(returnId, 'manual'));
              }}
            >
              <Icon name="check" className="h-4 w-4" />
              Approve — arrange pickup myself
            </button>
            ) : null}
            {canReject ? (
            <button
              type="button"
              className="btn-danger justify-start"
              disabled={pending}
              onClick={async () => {
                const reason = await prompt({
                  title: 'Reject this return?',
                  message: 'The customer sees this reason on their order page — be clear and kind.',
                  placeholder: 'e.g. Product was opened beyond the trial amount',
                  minLength: 10,
                  confirmLabel: 'Reject return',
                });
                if (reason) run(() => rejectReturn(returnId, reason));
              }}
            >
              <Icon name="x" className="h-4 w-4" />
              Reject request
            </button>
            ) : null}
          </div>
        </>
      ) : null}

      {status === 'approved' ? (
        <>
          <p className="text-body-sm text-fg-muted">
            Pickup is booked. When the parcel reaches the warehouse, mark it received to unlock the refund.
          </p>
          {canReceive ? (
          <button
            type="button"
            className="btn-accent w-full justify-start"
            disabled={pending}
            onClick={() => run(() => markReturnReceived(returnId))}
          >
            <Icon name="box" className="h-4 w-4" />
            Mark received at warehouse
          </button>
          ) : null}
        </>
      ) : null}

      {status === 'received' ? (
        <>
          <p className="text-body-sm text-fg-muted">
            {isPrepaid
              ? `Refund ${rupees} to the customer's original payment method via Cashfree.`
              : `COD order — Cashfree never held this money, so the ${rupees} payout is recorded here and transferred manually.`}
          </p>
          {canRefund ? (
          <button
            type="button"
            className="btn-accent w-full justify-start"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Refund ${rupees}?`,
                message: isPrepaid
                  ? 'Goes through the Cashfree refund API to the original payment method. This can’t be undone.'
                  : 'Recorded as a manual payout for this COD order. Transfer the money to the customer directly.',
                confirmLabel: 'Issue refund',
                tone: 'accent',
              });
              if (ok) run(() => refundReturn(returnId));
            }}
          >
            <Icon name="card" className="h-4 w-4" />
            {pending ? 'Working…' : `Refund ${rupees}${isPrepaid ? ' via Cashfree' : ' (manual)'}`}
          </button>
          ) : null}
        </>
      ) : null}

      {status === 'refunded' || status === 'rejected' ? (
        <p className="text-body-sm text-fg-muted">
          This return is closed{status === 'refunded' ? ' — the customer has been refunded.' : '.'}
        </p>
      ) : null}

      {canNotes ? (
      <form
        className="space-y-2 border-t border-paper-200 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addReturnNote(returnId, note));
          setNote('');
        }}
      >
        <label htmlFor="ret-note" className="field-label">Internal note</label>
        <textarea
          id="ret-note"
          className="field-input min-h-16"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Visible to the team only."
        />
        <button type="submit" className="btn-outline" disabled={pending || !note.trim()}>
          Add note
        </button>
      </form>
      ) : null}
    </div>
  );
}
