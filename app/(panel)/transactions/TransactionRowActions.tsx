'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { syncPaymentStatus } from '@/lib/actions/orders';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';

export function TransactionRowActions({
  orderId,
  isCashfree,
  canSync,
  canInvoice,
}: {
  orderId: string;
  isCashfree: boolean;
  canSync: boolean;
  canInvoice: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <div className="flex items-center justify-end gap-1">
      {isCashfree && canSync ? (
        <button
          type="button"
          disabled={pending}
          title="Check live status on Cashfree"
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-fg-muted transition-colors hover:bg-accent-soft hover:text-accent-pressed disabled:opacity-50"
          onClick={() => start(async () => toast(await syncPaymentStatus(orderId)))}
        >
          <Icon name="repeat" className={`h-3 w-3 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Checking…' : 'Sync'}
        </button>
      ) : null}
      {canInvoice ? (
      <a
        href={`/api/invoice/${orderId}/pdf`}
        download
        title="Download invoice PDF"
        className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-accent-soft hover:text-accent-pressed"
      >
        <Icon name="download" className="h-3.5 w-3.5" />
      </a>
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
