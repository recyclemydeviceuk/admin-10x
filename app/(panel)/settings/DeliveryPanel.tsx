'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/Toast';
import { saveDelivery, type DeliverySettings } from '@/lib/actions/settings';

/**
 * Delivery charges. One switch: free everywhere, or a flat fee below a
 * threshold. The checkout prices every order against whatever is saved here.
 */
export function DeliveryPanel({ delivery, canEdit }: { delivery: DeliverySettings; canEdit: boolean }) {
  const [mode, setMode] = useState<'free' | 'priced'>(delivery.deliveryMode);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <form
      action={(data) => start(async () => toast(await saveDelivery(data)))}
      className="card"
    >
      <h2 className="text-title">Delivery charges</h2>
      <p className="mt-1 text-body-sm text-fg-muted">
        The checkout prices every order against this — the storefront follows within seconds.
      </p>

      <input type="hidden" name="deliveryMode" value={mode} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === 'free'}
          disabled={!canEdit}
          title="Free delivery"
          detail="No delivery fee on any order, ever."
          onSelect={() => setMode('free')}
        />
        <ModeCard
          active={mode === 'priced'}
          disabled={!canEdit}
          title="Priced delivery"
          detail="Charge a flat fee below a free-delivery threshold."
          onSelect={() => setMode('priced')}
        />
      </div>

      {mode === 'priced' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="delivery-fee">Delivery fee (₹)</label>
            <input
              id="delivery-fee"
              name="flatShipping"
              type="number"
              min={0}
              step={1}
              defaultValue={delivery.flatShipping}
              disabled={!canEdit}
              required
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="delivery-free-over">Free delivery over (₹)</label>
            <input
              id="delivery-free-over"
              name="freeShippingOver"
              type="number"
              min={0}
              step={1}
              defaultValue={delivery.freeShippingOver}
              disabled={!canEdit}
              required
              className="field-input"
            />
            <p className="mt-1.5 text-caption text-fg-subtle">Orders at or above this amount ship free.</p>
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">
          Every order ships free — the cart and checkout show ₹0 delivery.
        </p>
      )}

      {canEdit ? (
        <div className="mt-6">
          <button className="btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Save delivery charges'}</button>
        </div>
      ) : (
        <p className="mt-6 text-caption text-fg-subtle">Your role can view these charges but not change them.</p>
      )}
    </form>
  );
}

function ModeCard({
  active,
  disabled,
  title,
  detail,
  onSelect,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-xl border-2 px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed ${
        active ? 'border-accent-pressed bg-accent/10' : 'border-paper-200 hover:border-fg-subtle'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`h-3.5 w-3.5 rounded-full border-2 ${active ? 'border-accent-pressed bg-accent' : 'border-paper-300'}`} />
        <span className="text-body font-semibold">{title}</span>
      </span>
      <span className="mt-1 block text-caption text-fg-muted">{detail}</span>
    </button>
  );
}
