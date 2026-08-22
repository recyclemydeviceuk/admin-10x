'use client';

import { useTransition } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';

export function PaymentActions({ orderId, canInvoice }: { orderId: string; canInvoice: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  if (!canInvoice) return null;

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
    </div>
  );
}
