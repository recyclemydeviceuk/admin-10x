'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';

export function TransactionRowActions({
  orderId,
  isCashfree,
  canInvoice,
}: {
  orderId: string;
  isCashfree: boolean;
  canInvoice: boolean;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <div className="flex items-center justify-end gap-1">
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
