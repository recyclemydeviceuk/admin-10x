'use client';

import { useTransition } from 'react';

import { useToast } from '@/components/Toast';
import { saveSubscriptionSettings, type SubscriptionSettings } from '@/lib/actions/settings';

/**
 * Subscription rules: how often a plan ships, and the auto-pay nudge loop.
 *
 * A subscriber pays their first box at checkout; after that each box is
 * pay-on-delivery until they approve a mandate. The reminder email goes out
 * on the cadence below until they enable auto-pay, say "I'll pay on
 * delivery", or the cap is reached.
 */
export function SubscriptionsPanel({ settings, canEdit }: { settings: SubscriptionSettings; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  return (
    <form action={(data) => start(async () => toast(await saveSubscriptionSettings(data)))} className="card">
      <h2 className="text-title">Subscriptions &amp; auto-pay</h2>
      <p className="mt-1 text-body-sm text-fg-muted">
        New plans ship on this cadence. Subscribers without auto-pay get a set-up email on the reminder
        schedule until they approve a mandate or choose pay on delivery.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="sub-interval">Deliver every (days)</label>
          <input
            id="sub-interval"
            name="subscriptionIntervalDays"
            type="number"
            min={7}
            max={90}
            step={1}
            defaultValue={settings.subscriptionIntervalDays}
            disabled={!canEdit}
            required
            className="field-input"
          />
          <p className="mt-1.5 text-caption text-fg-subtle">28 = every 4 weeks. Applies to new plans.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="sub-remind-every">Remind every (days)</label>
          <input
            id="sub-remind-every"
            name="autopayReminderEveryDays"
            type="number"
            min={0}
            max={30}
            step={1}
            defaultValue={settings.autopayReminderEveryDays}
            disabled={!canEdit}
            required
            className="field-input"
          />
          <p className="mt-1.5 text-caption text-fg-subtle">0 switches reminders off.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="sub-remind-max">Max reminders per plan</label>
          <input
            id="sub-remind-max"
            name="autopayReminderMax"
            type="number"
            min={0}
            max={20}
            step={1}
            defaultValue={settings.autopayReminderMax}
            disabled={!canEdit}
            required
            className="field-input"
          />
          <p className="mt-1.5 text-caption text-fg-subtle">Then we stop nudging that customer.</p>
        </div>
      </div>

      <p className="mt-5 rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">
        The team can also send the set-up link on demand from Subscriptions → “Send auto-pay link”. A mandate is
        approved by the customer in their own UPI / bank app — it can’t be created on their behalf.
      </p>

      {canEdit ? (
        <div className="mt-6">
          <button className="btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Save subscription rules'}</button>
        </div>
      ) : (
        <p className="mt-6 text-caption text-fg-subtle">Your role can view these rules but not change them.</p>
      )}
    </form>
  );
}
