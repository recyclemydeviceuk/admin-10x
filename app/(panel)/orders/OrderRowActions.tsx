'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { deleteOrder } from '@/lib/actions/orders';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';

export function OrderRowActions({ orderId, reference, canDelete }: { orderId: string; reference: string; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  return (
    <div className="flex items-center justify-end gap-1">
      {canDelete ? (
        <button
          type="button"
          disabled={pending}
          title="Delete order"
          className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${reference}?`,
              message: 'This removes the order permanently. For real orders, cancel instead — deletion is for test or duplicate entries.',
              confirmLabel: 'Delete order',
            });
            if (ok) start(async () => toast(await deleteOrder(orderId)));
          }}
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <Link
        href={`/orders/${orderId}`}
        title="Open order"
        className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-accent-soft hover:text-accent-pressed"
      >
        <Icon name="chevronRight" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
