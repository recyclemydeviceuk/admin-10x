'use client';

import { useTransition } from 'react';

import { useToast } from '@/components/Toast';
import { saveStoreSettings, type StoreSettings } from '@/lib/actions/settings';

/**
 * Store identity and the warehouse. The warehouse block is what Shiprocket
 * uses as the pickup / return-to address — returns cannot be booked while
 * it is empty.
 */
export function StorePanel({ settings, canEdit }: { settings: StoreSettings; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const field = (id: string, name: string, label: string, value: string, extra: Record<string, unknown> = {}) => (
    <div>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} name={name} defaultValue={value} disabled={!canEdit} className="field-input" {...extra} />
    </div>
  );

  return (
    <form action={(data) => start(async () => toast(await saveStoreSettings(data)))} className="space-y-4">
      <div className="card">
        <h2 className="text-title">Store</h2>
        <p className="mt-1 text-body-sm text-fg-muted">Name and support contacts shown on invoices and emails.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {field('st-name', 'name', 'Store name', settings.name, { required: true })}
          {field('st-email', 'supportEmail', 'Support email', settings.supportEmail, { type: 'email', required: true })}
          {field('st-phone', 'supportPhone', 'Support phone', settings.supportPhone)}
        </div>
        <label className="mt-5 flex cursor-pointer items-center gap-2 text-body-sm">
          <input type="checkbox" name="codEnabled" defaultChecked={settings.codEnabled} disabled={!canEdit} className="h-4 w-4" />
          Offer cash on delivery at checkout
        </label>
      </div>

      <div className="card">
        <h2 className="text-title">Warehouse</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          Where couriers collect parcels and deliver returns. This must match the pickup location in Shiprocket.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {field('wh-name', 'whName', 'Location name', settings.warehouse.name)}
          {field('wh-phone', 'whPhone', 'Phone', settings.warehouse.phone)}
          <div className="sm:col-span-2">{field('wh-address', 'whAddress', 'Address', settings.warehouse.address)}</div>
          {field('wh-city', 'whCity', 'City', settings.warehouse.city)}
          {field('wh-state', 'whState', 'State', settings.warehouse.state)}
          {field('wh-pin', 'whPincode', 'Pincode', settings.warehouse.pincode, { inputMode: 'numeric', maxLength: 6 })}
        </div>
        {canEdit ? (
          <div className="mt-6">
            <button className="btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Save store settings'}</button>
          </div>
        ) : (
          <p className="mt-6 text-caption text-fg-subtle">Your role can view these settings but not change them.</p>
        )}
      </div>
    </form>
  );
}
