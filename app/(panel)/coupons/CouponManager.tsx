'use client';

import { useState, useTransition } from 'react';
import { saveCoupon, toggleCoupon, deleteCoupon } from '@/lib/actions/coupons';
import type { ActionResult } from '@/lib/actions/orders';
import type { Coupon } from '@/lib/types';
import { Table, Pill, EmptyState } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Modal } from '@/components/Modal';

function CouponForm({
  coupon,
  onDone,
}: {
  coupon: Coupon | null;
  onDone: (result: ActionResult) => void;
}) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const [type, setType] = useState<'percent' | 'flat'>(coupon?.type ?? 'percent');

  return (
    <form
      className="space-y-4"
      action={(formData) =>
        start(async () => {
          const result = await saveCoupon(coupon?.id ?? null, formData);
          if (result.ok) onDone(result);
          else toast(result);
        })
      }
    >
      <div>
        <label className="field-label" htmlFor="code">
          Code
        </label>
        <input
          id="code"
          name="code"
          defaultValue={coupon?.code}
          required
          placeholder="LAUNCH20"
          className="field-input uppercase"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="value">
          Discount
        </label>
        <div className="flex gap-2">
          <input
            id="value"
            name="value"
            type="number"
            min={1}
            max={type === 'percent' ? 100 : undefined}
            defaultValue={coupon?.value}
            required
            placeholder={type === 'percent' ? '20' : '100'}
            className="field-input"
          />
          <div className="segment shrink-0">
            <button
              type="button"
              className={`segment-item ${type === 'percent' ? 'segment-item-active' : ''}`}
              onClick={() => setType('percent')}
            >
              %
            </button>
            <button
              type="button"
              className={`segment-item ${type === 'flat' ? 'segment-item-active' : ''}`}
              onClick={() => setType('flat')}
            >
              ₹
            </button>
          </div>
        </div>
        <input type="hidden" name="type" value={type} />
      </div>

      <div>
        <label className="field-label" htmlFor="description">Shown on the cart as</label>
        <input
          id="description"
          name="description"
          defaultValue={coupon?.description}
          placeholder="₹100 off orders over ₹999"
          className="field-input"
        />
        <p className="mt-1.5 text-caption text-fg-subtle">Leave empty to keep the coupon unlisted — customers must type it.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="minOrder">Minimum order (₹)</label>
          <input id="minOrder" name="minOrder" type="number" min={0} step={1} defaultValue={coupon?.minOrder ?? 0} className="field-input" />
        </div>
        {type === 'percent' ? (
          <div>
            <label className="field-label" htmlFor="maxDiscount">Max discount (₹)</label>
            <input id="maxDiscount" name="maxDiscount" type="number" min={0} step={1} defaultValue={coupon?.maxDiscount ?? ''} placeholder="No cap" className="field-input" />
          </div>
        ) : null}
        <div>
          <label className="field-label" htmlFor="usageLimit">Total uses</label>
          <input id="usageLimit" name="usageLimit" type="number" min={0} step={1} defaultValue={coupon?.usageLimit ?? ''} placeholder="Unlimited" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="perCustomerLimit">Uses per customer</label>
          <input id="perCustomerLimit" name="perCustomerLimit" type="number" min={0} step={1} defaultValue={coupon?.perCustomerLimit ?? ''} placeholder="Unlimited" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="expiresAt">Expires</label>
          <input id="expiresAt" name="expiresAt" type="date" defaultValue={coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : ''} className="field-input" />
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-body-sm">
            <input type="checkbox" name="active" defaultChecked={coupon ? coupon.active : true} className="h-4 w-4 accent-[var(--color-accent)]" />
            Active
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn-accent">
          {pending ? 'Saving…' : coupon ? 'Save' : 'Create'}
        </button>
        <button type="button" className="btn-outline" onClick={() => onDone({ ok: false, message: '' })}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** "New coupon" trigger for the header action row. */
export function NewCouponButton() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  return (
    <>
      <button type="button" className="btn-accent" onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-4 w-4" />
        New coupon
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New coupon">
        <CouponForm
          coupon={null}
          onDone={(result) => {
            setOpen(false);
            toast(result);
          }}
        />
      </Modal>
    </>
  );
}

export function CouponManager({ coupons, canEdit, canToggle, canDelete }: { coupons: Coupon[]; canEdit: boolean; canToggle: boolean; canDelete: boolean }) {
  const canAct = canEdit || canToggle || canDelete;
  const [editing, setEditing] = useState<Coupon | null | 'new'>(null);
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [pending, start] = useTransition();

  const now = new Date().toISOString();
  const stateOf = (c: Coupon) => {
    if (!c.active) return { label: 'Off', tone: 'neutral' as const };
    if (c.expiresAt && c.expiresAt < now) return { label: 'Expired', tone: 'warning' as const };
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: 'Used up', tone: 'warning' as const };
    return { label: 'Live', tone: 'accent' as const };
  };

  return (
    <>
      <Modal
        open={editing !== null && editing !== 'new'}
        onClose={() => setEditing(null)}
        title={editing && editing !== 'new' ? `Edit ${editing.code}` : 'Edit coupon'}
      >
        {editing && editing !== 'new' ? (
          <CouponForm
            coupon={editing}
            onDone={(result) => {
              setEditing(null);
              toast(result);
            }}
          />
        ) : null}
      </Modal>

      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" hint="Create one with a code and a discount." />
      ) : (
        <Table head={['Code', 'Discount', 'Used', 'State', ...(canAct ? [''] : [])]}>
          {coupons.map((c) => {
            const s = stateOf(c);
            return (
              <tr key={c.id} className="hover:bg-accent-soft/40">
                <td className="px-3 py-2.5 first:pl-4 last:pr-4 font-semibold uppercase">{c.code}</td>
                <td className="px-3 py-2.5 first:pl-4 last:pr-4">{c.type === 'percent' ? `${c.value}% off` : `₹${c.value} off`}</td>
                <td className="px-3 py-2.5 first:pl-4 last:pr-4 tabular-nums">{c.usedCount}</td>
                <td className="px-3 py-2.5 first:pl-4 last:pr-4">
                  <Pill tone={s.tone}>{s.label}</Pill>
                </td>
                {canAct ? (
                  <td className="px-3 py-2.5 first:pl-4 last:pr-4">
                    <div className="flex justify-end gap-3">
                      {canEdit ? (
                      <button type="button" className="text-caption font-medium text-fg-muted hover:text-fg" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                      ) : null}
                      {canToggle ? (
                      <button
                        type="button"
                        className="text-caption font-medium text-fg-muted hover:text-fg"
                        disabled={pending}
                        onClick={() => start(async () => toast(await toggleCoupon(c.id)))}
                      >
                        {c.active ? 'Disable' : 'Enable'}
                      </button>
                      ) : null}
                      {canDelete ? (
                      <button
                        type="button"
                        className="text-caption font-medium text-danger/70 hover:text-danger"
                        disabled={pending}
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Delete ${c.code}?`,
                            message: 'Orders that already used it keep their discount.',
                            confirmLabel: 'Delete coupon',
                          });
                          if (ok) start(async () => toast(await deleteCoupon(c.id)));
                        }}
                      >
                        Delete
                      </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
