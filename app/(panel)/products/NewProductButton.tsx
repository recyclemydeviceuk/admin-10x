'use client';

import { useState, useTransition } from 'react';
import { createProduct } from '@/lib/actions/products';
import type { ActionResult } from '@/lib/actions/orders';
import { Icon } from '@/components/Icon';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/Toast';

export function NewProductButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <>
      <button type="button" className="btn-accent" onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-4 w-4" />
        New product
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New product">
        <form
          className="grid gap-4"
          action={(fd) =>
            start(async () => {
              // On success this redirects straight into the editor.
              const result = (await createProduct(fd)) as ActionResult | undefined;
              if (result && !result.ok) toast(result);
            })
          }
        >
          <div>
            <label className="field-label" htmlFor="np-name">Product name</label>
            <input id="np-name" name="name" required autoFocus placeholder="e.g. 10X Nighttime" className="field-input" />
            <p className="mt-1.5 text-caption text-fg-subtle">Starts as a draft — you land in the editor to fill in packs, images and copy.</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-accent" disabled={pending}>
              {pending ? 'Creating…' : 'Create draft'}
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
