'use client';

import { useState, useTransition } from 'react';
import { createManualOrder, type ActionResult } from '@/lib/actions/orders';
import { Select } from '@/components/Select';
import { inr } from '@/lib/format';
import { useToast } from '@/components/Toast';

type CustomerOption = { id: string; name: string; email: string; phone: string; city: string; state: string };
type TierOption = { id: string; name: string; packets: number; oneTimePrice: number };

export function NewOrderForm({
  customers,
  tiers,
}: {
  customers: CustomerOption[];
  tiers: TierOption[];
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [tierId, setTierId] = useState(tiers[0]?.id ?? '');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [quantity, setQuantity] = useState(1);

  const tier = tiers.find((t) => t.id === tierId);
  const subtotal = (tier?.oneTimePrice ?? 0) * quantity;
  const shipping = subtotal >= 999 ? 0 : 79;

  return (
    <form
      className="max-w-3xl space-y-6"
      action={(formData) =>
        start(async () => {
          const result = (await createManualOrder(formData)) as ActionResult | undefined;
          // On success the action redirects to the new order; reaching here means it failed.
          if (result && !result.ok) toast(result);
        })
      }
    >
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-title sm:col-span-2">Who and what</h2>
        <div>
          <label className="field-label" htmlFor="customerId">Customer</label>
          <Select
            id="customerId"
            name="customerId"
            options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.email }))}
            value={customerId}
            onChange={setCustomerId}
            placeholder="Pick a customer"
          />
          <p className="mt-1.5 text-caption text-fg-subtle">New buyer? Add them in Customers first.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="tierId">Pack</label>
          <Select
            id="tierId"
            name="tierId"
            options={tiers.map((t) => ({ value: t.id, label: `${t.name} — ${inr(t.oneTimePrice)}` }))}
            value={tierId}
            onChange={setTierId}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="quantity">Quantity</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(Number(e.target.value) || 1, 1))}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="paymentMethod">Payment</label>
          <Select
            id="paymentMethod"
            name="paymentMethod"
            options={[
              { value: 'cod', label: 'Cash on delivery', hint: 'Collect on delivery' },
              { value: 'online', label: 'Prepaid', hint: 'Already paid (record as paid)' },
            ]}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="text-title sm:col-span-2">Shipping address</h2>
        <div>
          <label className="field-label" htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" className="field-input" placeholder="Defaults to the customer's name" />
        </div>
        <div>
          <label className="field-label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className="field-input" placeholder="Defaults to the customer's phone" />
        </div>
        <div>
          <label className="field-label" htmlFor="house">House / flat / building</label>
          <input id="house" name="house" required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="street">Street / area</label>
          <input id="street" name="street" required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="city">City</label>
          <input id="city" name="city" className="field-input" placeholder="Defaults to the customer's city" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label" htmlFor="state">State</label>
            <input id="state" name="state" className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="pincode">Pincode</label>
            <input id="pincode" name="pincode" required className="field-input" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="order-note">Note (optional)</label>
          <input id="order-note" name="note" className="field-input" placeholder="e.g. WhatsApp order, replacement for 10X-1102" />
        </div>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4">
        <div className="text-body">
          <p className="text-fg-muted">
            {quantity} × {tier?.name ?? ''} · shipping {shipping === 0 ? 'free' : inr(shipping)}
          </p>
          <p className="brand-head mt-1 text-[1.25rem]">Total {inr(subtotal + shipping)}</p>
        </div>
        <button type="submit" className="btn-accent px-8 py-3" disabled={pending || !customerId}>
          {pending ? 'Creating…' : 'Create order'}
        </button>
      </section>
    </form>
  );
}
