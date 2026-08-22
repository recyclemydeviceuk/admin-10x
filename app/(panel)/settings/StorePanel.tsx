'use client';

import { useTransition } from 'react';

import { useToast } from '@/components/Toast';
import { saveStoreSettings, type StoreSettings } from '@/lib/actions/settings';
import { SocialLinksEditor } from './SocialLinksEditor';

/**
 * Store identity and support contacts. The warehouse is shown, not edited:
 * Shiprocket owns the pickup address (it verifies the phone and ties
 * couriers to it), so it is managed there once and read here.
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
  const pickup = settings.pickup;

  return (
    <div className="space-y-4">
      <form action={(data) => start(async () => toast(await saveStoreSettings(data)))} className="card">
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

        <div className="mt-8 border-t border-paper-200 pt-6">
          <h3 className="text-body font-semibold">Social links</h3>
          <p className="mt-1 text-body-sm text-fg-muted">
            Shown as icons in the storefront footer, in this order. The support email is always the last icon.
          </p>
          <div className="mt-4">
            <SocialLinksEditor initial={settings.socialLinks} disabled={!canEdit} />
          </div>
        </div>
        {canEdit ? (
          <div className="mt-6">
            <button className="btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Save store settings'}</button>
          </div>
        ) : (
          <p className="mt-6 text-caption text-fg-subtle">Your role can view these settings but not change them.</p>
        )}
      </form>

      <div className="card">
        <h2 className="text-title">Warehouse</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          Where couriers collect parcels and deliver returns — read from Shiprocket, where it is set up once
          (Settings → Pickup Addresses). Live delivery rates are quoted from this pincode.
        </p>
        {!settings.shiprocketConfigured ? (
          <p className="mt-5 rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">
            Shiprocket isn’t connected on the backend yet (SHIPROCKET_EMAIL / PASSWORD).
          </p>
        ) : pickup ? (
          <dl className="mt-5 grid gap-x-6 gap-y-3 text-body-sm sm:grid-cols-2">
            <div><dt className="text-caption text-fg-subtle">Pickup location</dt><dd className="font-semibold">{pickup.name}</dd></div>
            <div><dt className="text-caption text-fg-subtle">Phone</dt><dd>{pickup.phone || '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-caption text-fg-subtle">Address</dt><dd>{[pickup.address, pickup.address2].filter(Boolean).join(', ')}</dd></div>
            <div><dt className="text-caption text-fg-subtle">City / state</dt><dd>{pickup.city}, {pickup.state}</dd></div>
            <div><dt className="text-caption text-fg-subtle">Pincode</dt><dd>{pickup.pincode}</dd></div>
          </dl>
        ) : (
          <p className="mt-5 rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">
            No pickup address found in Shiprocket{settings.pickupNickname ? ` matching “${settings.pickupNickname}”` : ''}. Add one there and it appears here.
          </p>
        )}
        {pickup && settings.pickupNickname && pickup.name.toLowerCase() !== settings.pickupNickname.toLowerCase() ? (
          <p className="mt-4 text-caption text-fg-muted">
            The backend is set to use “{settings.pickupNickname}”, which Shiprocket doesn’t have — showing “{pickup.name}” instead. Set SHIPROCKET_PICKUP_LOCATION to match.
          </p>
        ) : null}
      </div>
    </div>
  );
}
