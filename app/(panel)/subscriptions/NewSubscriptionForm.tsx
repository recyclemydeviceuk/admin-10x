'use client';

import { useState, useTransition } from 'react';
import { createSubscription } from '@/lib/actions/subscriptions';
import { Select } from '@/components/Select';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

export function NewSubscriptionForm({
  customers,
  defaultPrice,
}: {
  customers: { id: string; name: string; email: string }[];
  defaultPrice: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');

  return (
    <>
      <button type="button" className="btn-accent" onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-4 w-4" />
        New subscription
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New subscription — 10X Daytime, every 4 weeks">
        <form
          className="grid gap-4"
          action={(fd) =>
            start(async () => {
              const result = await createSubscription(fd);
              toast(result);
              if (result.ok) setOpen(false);
            })
          }
        >
          <div>
            <label className="field-label" htmlFor="s-customer">Customer</label>
            <Select
              id="s-customer"
              name="customerId"
              options={customers.map((c) => ({ value: c.id, label: c.name, hint: c.email }))}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Pick a customer"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label" htmlFor="s-price">Price per cycle (₹)</label>
              <input id="s-price" name="price" type="number" min={1} defaultValue={defaultPrice} required className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="s-next">First delivery</label>
              <input id="s-next" name="nextDelivery" type="date" required className="field-input" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-accent" disabled={pending || !customerId}>
              {pending ? 'Creating…' : 'Create subscription'}
            </button>
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
