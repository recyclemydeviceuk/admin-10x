'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/Toast';
import { saveDelivery, type DeliveryMode, type DeliverySettings } from '@/lib/actions/settings';

/**
 * Delivery charges. Three ways to price delivery; the cart and checkout
 * follow whichever is saved here within seconds:
 *   free   — never charge
 *   priced — a flat fee, waived above a threshold
 *   live   — Shiprocket's real courier rate for the customer's pincode,
 *            quoted as they shop; the flat fee covers the rare miss
 */
export function DeliveryPanel({ delivery, canEdit }: { delivery: DeliverySettings; canEdit: boolean }) {
  const [mode, setMode] = useState<DeliveryMode>(delivery.deliveryMode);
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

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
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
          title="Flat fee"
          detail="One fixed fee, waived above a threshold."
          onSelect={() => setMode('priced')}
        />
        <ModeCard
          active={mode === 'live'}
          disabled={!canEdit}
          title="Live courier rate"
          detail="Shiprocket’s real rate for the customer’s pincode, shown in the cart as they shop."
          onSelect={() => setMode('live')}
        />
      </div>

      {mode !== 'free' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="delivery-fee">{mode === 'live' ? 'Fallback fee (₹)' : 'Delivery fee (₹)'}</label>
            <input
              id="delivery-fee"
              name="flatShipping"
              type="number"
              min={0}
              step={1}
              defaultValue={delivery.flatShipping}
              placeholder="0"
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
            <p className="mt-1.5 text-caption text-fg-subtle">Orders at or above this amount ship free. 0 = never.</p>
          </div>
          {mode === 'live' ? (
            <p className="rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted sm:col-span-2">
              The customer enters a pincode in the cart (or picks an address at checkout) and sees the courier, the
              rate and the delivery estimate from Shiprocket, quoted from your pickup pincode. Cash-on-delivery rates
              include the courier’s COD charge. The fallback fee is charged only if Shiprocket can’t answer.
            </p>
          ) : null}
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
