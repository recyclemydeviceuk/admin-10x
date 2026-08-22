'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateOrderStatus,
  addOrderNote,
  refundOrder,
  createShipment,
  assignAwbAction,
  requestPickupAction,
  generateLabelAction,
  generateInvoiceAction,
  cancelShipmentAction,
  setManualTracking,
  deleteOrder,
  type ActionResult,
} from '@/lib/actions/orders';
import type { OrderStatus, Shipment } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';

/* ------------------------------------------------------- status + notes */

export function OrderActions({
  orderId,
  status,
  paymentStatus,
  canStatus,
  canRefund,
  canNotes,
  canDelete,
}: {
  orderId: string;
  status: OrderStatus;
  paymentStatus: string;
  canStatus: boolean;
  canRefund: boolean;
  canNotes: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [pending, start] = useTransition();
  const [note, setNote] = useState('');
  const [confirmRefund, setConfirmRefund] = useState(false);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        toast(await fn());
      } catch (err) {
        toast({ ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' });
      }
      setConfirmRefund(false);
    });

  if (!canStatus && !canRefund && !canNotes && !canDelete) {
    return (
      <div className="card">
        <h2 className="text-title mb-2">Actions</h2>
        <p className="text-body-sm text-fg-subtle">Your role can view this order but not change it.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-5">
      <h2 className="text-title">Order</h2>

      {/* Status is OWNED BY SHIPROCKET: the webhook and the syncing worker
          map the courier's own updates onto the order, so a hand-picked status
          can never disagree with where the parcel actually is. The one manual
          act that remains is cancelling — a decision, not a location. */}
      {/* A placed order waits for its payment (online) or a nod from the team
          (cash on delivery / manual). Confirming is what lets it ship. */}
      {canStatus && status === 'placed' ? (
        <button
          type="button"
          className="btn-accent w-full justify-center"
          disabled={pending}
          onClick={() => run(() => updateOrderStatus(orderId, 'confirmed'))}
        >
          Confirm order
        </button>
      ) : null}

      {canStatus && status !== 'cancelled' && status !== 'delivered' && status !== 'returned' ? (
        <button
          type="button"
          className="btn-danger w-full justify-center"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: 'Cancel this order?',
              message: 'Stock returns to the shelf. A paid order starts its refund automatically.',
              confirmLabel: 'Cancel order',
              tone: 'danger',
            });
            if (ok) run(() => updateOrderStatus(orderId, 'cancelled'));
          }}
        >
          Cancel order
        </button>
      ) : null}

      {canRefund && paymentStatus === 'paid' ? (
        confirmRefund ? (
          <div className="space-y-2.5 rounded-lg border border-danger/40 p-4">
            <p className="text-body-sm text-fg-muted">
              Refund the full order amount? Prepaid orders go through Cashfree; COD is recorded manually.
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-danger flex-1" disabled={pending} onClick={() => run(() => refundOrder(orderId, note))}>
                Yes, refund
              </button>
              <button type="button" className="btn-outline flex-1" onClick={() => setConfirmRefund(false)}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-outline w-full" onClick={() => setConfirmRefund(true)}>
            Refund order
          </button>
        )
      ) : null}

      {canNotes ? (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addOrderNote(orderId, note));
          setNote('');
        }}
      >
        <label htmlFor="note" className="field-label">
          Internal note
        </label>
        <textarea
          id="note"
          className="field-input min-h-20"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Visible to the team only."
        />
        <button type="submit" className="btn-outline" disabled={pending || !note.trim()}>
          Add note
        </button>
      </form>
      ) : null}

      {canDelete ? (
      <div className="border-t border-paper-200 pt-4">
        <button
          type="button"
          className="text-body-sm font-medium text-danger/70 transition-colors hover:text-danger"
          disabled={pending}
          onClick={async () => {
            const ok = await confirm({
              title: 'Delete this order?',
              message: 'This removes it permanently. For real orders, cancel instead — deletion is for test or duplicate entries.',
              confirmLabel: 'Delete order',
            });
            if (!ok) return;
            start(async () => {
              const res = await deleteOrder(orderId);
              if (res.ok) router.push('/orders');
              toast(res);
            });
          }}
        >
          Delete this order permanently
        </button>
      </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------- fulfilment / shipping */

export function FulfilmentPanel({
  orderId,
  shipment,
  courier,
  trackingNumber,
  canFulfil,
  canManual,
  autoShipments = false,
}: {
  orderId: string;
  shipment?: Shipment;
  courier?: string;
  trackingNumber?: string;
  canFulfil: boolean;
  canManual: boolean;
  autoShipments?: boolean;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [pending, start] = useTransition();
  const [manualCourier, setManualCourier] = useState(courier ?? '');
  const [manualAwb, setManualAwb] = useState(trackingNumber ?? '');
  const [showManual, setShowManual] = useState(false);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        toast(await fn());
      } catch (err) {
        toast({ ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' });
      }
    });

  if (!canFulfil && !canManual) return null;

  const hasShipment = Boolean(shipment?.shipmentId);
  const hasAwb = Boolean(shipment?.awb);

  const ApiButton = ({ label, icon, onClick, primary }: { label: string; icon: string; onClick: () => void; primary?: boolean }) => (
    <button type="button" className={`${primary ? 'btn-accent' : 'btn-outline'} justify-start`} disabled={pending} onClick={onClick}>
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-title">Fulfilment</h2>
        <span className="text-caption text-fg-subtle">Shiprocket + manual</span>
      </div>

      {autoShipments && !hasShipment ? (
        <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-caption text-accent-pressed">
          Auto-book is on — confirmed orders get a courier booked and pickup requested within a minute.
          The button below does the same thing right now.
        </p>
      ) : null}
      {hasShipment && shipment?.pickupRequestedAt ? (
        <p className="rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">
          Pickup requested — the courier is on the way. Status now follows the courier automatically.
        </p>
      ) : null}

      {canFulfil ? (
        <div className="grid gap-2">
          {!hasShipment ? (
            <ApiButton primary label={pending ? 'Working…' : 'Create Shiprocket shipment'} icon="truck" onClick={() => run(() => createShipment(orderId))} />
          ) : null}
          {hasShipment && !hasAwb ? (
            <ApiButton primary label="Assign AWB (courier)" icon="truck" onClick={() => run(() => assignAwbAction(orderId))} />
          ) : null}
          {hasAwb ? (
            <>
              {!shipment?.pickupRequestedAt ? (
                <ApiButton primary label="Request pickup" icon="upload" onClick={() => run(() => requestPickupAction(orderId))} />
              ) : null}
              <ApiButton label="Generate label (PDF)" icon="download" onClick={() => run(() => generateLabelAction(orderId))} />
              <ApiButton label="Shiprocket invoice (PDF)" icon="download" onClick={() => run(() => generateInvoiceAction(orderId))} />
            </>
          ) : null}
          {hasShipment && !shipment?.pickupRequestedAt ? (
            <button
              type="button"
              className="btn-danger justify-start"
              disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Cancel this shipment?',
                  message: 'Cancels the Shiprocket booking — works before pickup. You can create a fresh shipment after.',
                  confirmLabel: 'Cancel shipment',
                  cancelLabel: 'Keep it',
                });
                if (ok) run(() => cancelShipmentAction(orderId));
              }}
            >
              <Icon name="x" className="h-4 w-4" />
              Cancel shipment
            </button>
          ) : null}
        </div>
      ) : null}

      {canManual ? (
        <div className="border-t border-paper-200 pt-4">
          <button
            type="button"
            className="mb-3 flex items-center gap-1.5 text-body-sm font-medium text-fg-muted transition-colors hover:text-fg"
            onClick={() => setShowManual((s) => !s)}
          >
            <Icon name={showManual ? 'chevronLeft' : 'chevronRight'} className="h-3.5 w-3.5" />
            Update tracking manually
          </button>
          {showManual ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => setManualTracking(orderId, manualCourier, manualAwb));
              }}
            >
              <div>
                <label className="field-label" htmlFor="m-courier">Courier</label>
                <input id="m-courier" className="field-input" value={manualCourier} onChange={(e) => setManualCourier(e.target.value)} placeholder="Delhivery, Blue Dart…" />
              </div>
              <div>
                <label className="field-label" htmlFor="m-awb">AWB / tracking number</label>
                <input id="m-awb" className="field-input" value={manualAwb} onChange={(e) => setManualAwb(e.target.value)} placeholder="AWB123456789" />
              </div>
              <button type="submit" className="btn-outline" disabled={pending}>
                Save tracking
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
