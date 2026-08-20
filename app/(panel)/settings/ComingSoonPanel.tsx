'use client';

import { useState, useTransition } from 'react';

import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Icon } from '@/components/Icon';
import { saveComingSoon, type SignupRow } from '@/lib/actions/settings';

/**
 * The launch switch and its harvest. ON = the storefront shows only the
 * coming-soon page (legal pages stay reachable); every email the page
 * collects lands in the list below.
 */
export function ComingSoonPanel({
  enabled,
  total,
  signups,
}: {
  enabled: boolean;
  total: number;
  signups: SignupRow[];
}) {
  const [on, setOn] = useState(enabled);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  async function flip(next: boolean) {
    if (pending || confirming || next === on) return;

    // Confirmation must happen outside the transition. Opening the dialog
    // inside an async transition can defer its render while that same
    // transition waits for the dialog promise, leaving this direction stuck.
    if (next) {
      setConfirming(true);
      const accepted = await confirm({
        title: 'Take the storefront down?',
        message: 'Every visitor sees the coming-soon page instead of the shop. Orders stop until you switch back.',
        confirmLabel: 'Show coming soon',
      });
      setConfirming(false);
      if (!accepted) return;
    }

    start(async () => {
      const result = await saveComingSoon(next);
      toast(result);
      if (result.ok) setOn(next);
    });
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-title">Coming soon page</h2>
            <p className="mt-1 max-w-lg text-body-sm text-fg-muted">
              One switch: show the battery launch page instead of the shop. Legal pages stay up, and the storefront follows within seconds.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-semibold ${
              on ? 'bg-warning/10 text-warning' : 'bg-accent/20 text-accent-pressed'
            }`}
          >
            {on ? 'Coming soon is ON' : 'Storefront is LIVE'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={!on}
            disabled={pending || confirming}
            title="Storefront live"
            detail="The shop runs normally — products, cart, checkout."
            onSelect={() => void flip(false)}
          />
          <ModeCard
            active={on}
            disabled={pending || confirming}
            title="Show coming soon"
            detail="Visitors see the launch page and can leave their email."
            onSelect={() => void flip(true)}
          />
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-title">Early-access signups</h2>
            <p className="mt-1 text-body-sm text-fg-muted">
              Every email the coming-soon page collects — stored here, not with a third party.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1 text-caption font-semibold text-fg-muted">
            <Icon name="users" className="h-3.5 w-3.5" />
            {total} total
          </span>
        </div>

        {signups.length === 0 ? (
          <p className="mt-5 rounded-lg bg-paper-100 px-3.5 py-2.5 text-body-sm text-fg-muted">
            No signups yet — they appear here the moment someone joins the list.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-paper-200">
            {signups.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-body font-medium">{row.email}</span>
                <span className="shrink-0 text-caption text-fg-subtle">
                  {new Date(row.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
      className={`rounded-xl border-2 px-4 py-3.5 text-left transition-colors disabled:cursor-wait disabled:opacity-60 ${
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
