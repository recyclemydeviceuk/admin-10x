'use client';

import { useTransition } from 'react';
import { syncPaymentStatus } from '@/lib/actions/orders';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';

export function PaymentActions({ orderId, isCashfree, canSync, canInvoice }: { orderId: string; isCashfree: boolean; canSync: boolean; canInvoice: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  if (!canInvoice && !(isCashfree && canSync)) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-paper-200 pt-4">
      {canInvoice ? (
        <>
          <a href={`/api/invoice/${orderId}/pdf`} download className="btn-outline flex-1 px-3 py-2 text-caption">
            <Icon name="download" className="h-3.5 w-3.5" />
            Invoice PDF
          </a>
          <a href={`/api/invoice/${orderId}`} target="_blank" rel="noreferrer" title="Print view" className="btn-outline px-3 py-2 text-caption">
            <Icon name="eye" className="h-3.5 w-3.5" />
          </a>
        </>
      ) : null}
      {isCashfree && canSync ? (
        <button
          type="button"
          disabled={pending}
          className="btn-outline flex-1 px-3 py-2 text-caption"
          onClick={() => start(async () => toast(await syncPaymentStatus(orderId)))}
        >
          <Icon name="repeat" className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          {pending ? 'Checking…' : 'Sync Cashfree'}
        </button>
      ) : null}
    </div>
  );
}
