'use client';

import { useTransition } from 'react';
import { setSubscriptionStatus, deleteSubscription, sendAutopayReminder } from '@/lib/actions/subscriptions';
import type { SubscriptionStatus } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';

export function SubscriptionRowActions({
  subId,
  status,
  canPause,
  canCancel,
  canDelete,
  canRemind = false,
}: {
  subId: string;
  status: SubscriptionStatus;
  canPause: boolean;
  canCancel: boolean;
  canDelete: boolean;
  /** Active plan without a mandate and the customer hasn't declined. */
  canRemind?: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const act = (next: SubscriptionStatus) =>
    start(async () => toast(await setSubscriptionStatus(subId, next)));

  const cancelPlan = async (message: string) => {
    const ok = await confirm({
      title: 'Cancel this subscription?',
      message,
      confirmLabel: 'Cancel plan',
      cancelLabel: 'Keep it',
    });
    if (ok) act('cancelled');
  };

  const linkClass = 'text-caption font-medium transition-colors';

  return (
    <div className="flex gap-3">
      {status === 'active' ? (
        <>
          {canRemind ? (
          <button
            type="button"
            disabled={pending}
            title="Email the customer a link to approve auto-pay"
            className={`${linkClass} text-accent-pressed hover:text-fg`}
            onClick={() => start(async () => toast(await sendAutopayReminder(subId)))}
          >
            Send auto-pay link
          </button>
          ) : null}
          {canPause ? (
          <button type="button" disabled={pending} className={`${linkClass} text-fg-muted hover:text-fg`} onClick={() => act('paused')}>
            Pause
          </button>
          ) : null}
          {canCancel ? (
          <button
            type="button"
            disabled={pending}
            className={`${linkClass} text-danger/70 hover:text-danger`}
            onClick={() => cancelPlan('The customer keeps already-shipped cycles. You can reactivate it later.')}
          >
            Cancel
          </button>
          ) : null}
        </>
      ) : status === 'paused' ? (
        <>
          {canPause ? (
          <button type="button" disabled={pending} className={`${linkClass} text-accent-pressed hover:text-fg`} onClick={() => act('active')}>
            Resume
          </button>
          ) : null}
          {canCancel ? (
          <button
            type="button"
            disabled={pending}
            className={`${linkClass} text-danger/70 hover:text-danger`}
            onClick={() => cancelPlan('It is paused right now. You can reactivate it later if the customer changes their mind.')}
          >
            Cancel
          </button>
          ) : null}
        </>
      ) : (
        <>
          {canPause ? (
          <button type="button" disabled={pending} className={`${linkClass} text-fg-muted hover:text-fg`} onClick={() => act('active')}>
            Reactivate
          </button>
          ) : null}
          {canDelete ? (
          <button
            type="button"
            disabled={pending}
            className={`${linkClass} text-danger/70 hover:text-danger`}
            onClick={async () => {
              const ok = await confirm({
                title: 'Delete this subscription record?',
                message: 'This removes it permanently. Cancelled plans usually stay on the books for history.',
                confirmLabel: 'Delete record',
              });
              if (ok) start(async () => toast(await deleteSubscription(subId)));
            }}
          >
            Delete
          </button>
          ) : null}
        </>
      )}
    </div>
  );
}
