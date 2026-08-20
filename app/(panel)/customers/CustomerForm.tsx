'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer, updateCustomer, deleteCustomer } from '@/lib/actions/customers';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Modal } from '@/components/Modal';

type CustomerFields = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  marketingOptIn?: boolean;
};

function Fields({ customer, pending }: { customer: CustomerFields; pending: boolean }) {
  return (
    <>
      <div>
        <label className="field-label" htmlFor="c-name">Name</label>
        <input id="c-name" name="name" required defaultValue={customer.name} disabled={pending} className="field-input" />
      </div>
      <div>
        <label className="field-label" htmlFor="c-email">Email</label>
        <input id="c-email" name="email" type="email" required defaultValue={customer.email} disabled={pending} className="field-input" />
      </div>
      <div>
        <label className="field-label" htmlFor="c-phone">Phone</label>
        <input id="c-phone" name="phone" required defaultValue={customer.phone} disabled={pending} className="field-input" placeholder="+91 …" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="c-city">City</label>
          <input id="c-city" name="city" defaultValue={customer.city} disabled={pending} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="c-state">State</label>
          <input id="c-state" name="state" defaultValue={customer.state} disabled={pending} className="field-input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-body-sm sm:col-span-2">
        <input type="checkbox" name="marketingOptIn" defaultChecked={customer.marketingOptIn ?? true} disabled={pending} className="h-4 w-4 accent-[#4EA310]" />
        Opted in to marketing
      </label>
    </>
  );
}

/** "Add customer" trigger for the header action row — form opens in a modal. */
export function AddCustomerButton() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <>
      <button type="button" className="btn-accent" onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-4 w-4" />
        Add customer
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New customer" wide>
        <form
          className="grid gap-4 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const result = await createCustomer(fd);
              toast(result);
              if (result.ok) setOpen(false);
            })
          }
        >
          <Fields customer={{}} pending={pending} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-accent" disabled={pending}>
              {pending ? 'Adding…' : 'Add customer'}
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

/** Edit + delete controls for the customer detail page. */
export function EditCustomerPanel({ customer, canDelete }: { customer: Required<CustomerFields>; canDelete: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  return (
    <div className="mb-6">
      {!open ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
            Edit customer
          </button>
          {canDelete ? (
          <button
            type="button"
            className="btn-outline text-danger"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${customer.name}?`,
                message: 'Only customers with no order history can be deleted. This can’t be undone.',
                confirmLabel: 'Delete customer',
              });
              if (!ok) return;
              start(async () => {
                const result = await deleteCustomer(customer.id);
                if (result.ok) router.push('/customers');
                toast(result);
              });
            }}
          >
            Delete
          </button>
          ) : null}
        </div>
      ) : (
        <form
          className="card grid gap-4 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const result = await updateCustomer(customer.id, fd);
              toast(result);
              if (result.ok) setOpen(false);
            })
          }
        >
          <h2 className="text-title sm:col-span-2">Edit customer</h2>
          <Fields customer={customer} pending={pending} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-accent" disabled={pending}>
              {pending ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
