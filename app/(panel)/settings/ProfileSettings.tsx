'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/Toast';
import {
  changeOwnPassword,
  removeAdminPhoto,
  runSyncNow,
  saveAdminProfile,
  uploadAdminPhoto,
} from '@/lib/actions/profile';

type Profile = {
  name: string;
  email: string;
  avatarUrl: string;
  preferences: {
    fontScale: number;
    density: 'comfortable' | 'compact';
    sidebarCollapsed: boolean;
    reduceMotion: boolean;
  };
};

const DEFAULT_PROFILE: Profile = {
  name: 'Admin',
  email: '',
  avatarUrl: '',
  preferences: { fontScale: 100, density: 'comfortable', sidebarCollapsed: false, reduceMotion: false },
};

export function ProfilePanel({ profile = DEFAULT_PROFILE, isPrimary = false }: { profile?: Profile; isPrimary?: boolean }) {
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(profile.avatarUrl);
  const { toast } = useToast();

  return (
    // Photo and details in one card, side by side: they are the same subject,
    // and two stacked cards left a wide empty block beside the avatar.
    <form
      action={(data) => start(async () => toast(await saveAdminProfile(data)))}
      className="card"
    >
      <h2 className="text-title">Your profile</h2>
      <p className="mt-1 text-body-sm text-fg-muted">
        How you appear in this panel. The sign-in email stays protected in the backend environment.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          {preview ? (
            <img src={preview} alt="Admin profile" className="h-24 w-24 rounded-full border border-paper-200 object-cover" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-ink">
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col items-center gap-1.5">
            <label className="btn-outline cursor-pointer py-2 text-caption">
              {pending ? 'Uploading…' : preview ? 'Change photo' : 'Upload photo'}
              <input
                className="sr-only"
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPreview(URL.createObjectURL(file));
                  const data = new FormData();
                  data.append('photo', file);
                  start(async () => toast(await uploadAdminPhoto(data)));
                }}
              />
            </label>
            {preview ? (
              <button
                type="button"
                className="text-caption text-fg-subtle transition-colors hover:text-danger"
                disabled={pending}
                onClick={() => start(async () => {
                  const out = await removeAdminPhoto();
                  if (out.ok) setPreview('');
                  toast(out);
                })}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>

        {/* Details */}
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="admin-name">Name</label>
            <input id="admin-name" name="name" defaultValue={profile.name} minLength={2} required className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="admin-email">Contact email</label>
            <input id="admin-email" name="email" type="email" defaultValue={profile.email} required disabled={isPrimary} className="field-input disabled:cursor-not-allowed disabled:opacity-60" />
            <p className="mt-1.5 text-caption text-fg-subtle">
              {isPrimary
                ? "The Super Admin email is fixed in the server's .env file."
                : 'Used for your displayed profile and notifications.'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Save profile'}</button>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * Every team member owns their password; only the .env owner's is fixed. The
 * card renders in both cases so the rule is visible, not just enforced.
 */
export function PasswordPanel({ isPrimary }: { isPrimary: boolean }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();

  if (isPrimary) {
    return (
      <div className="card mt-5">
        <h2 className="text-title">Password</h2>
        <p className="mt-1 text-body-sm text-fg-muted">
          The Super Admin password is configured in the server&rsquo;s .env file and cannot be changed from the panel.
        </p>
      </div>
    );
  }

  return (
    <form
      action={(data) => start(async () => toast(await changeOwnPassword(data)))}
      className="card mt-5"
    >
      <h2 className="text-title">Change password</h2>
      <p className="mt-1 text-body-sm text-fg-muted">Use 12+ characters with uppercase, lowercase, a number, and a symbol.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="current-password">Current password</label>
          <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="new-password">New password</label>
          <input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required className="field-input" />
        </div>
      </div>
      <div className="mt-5">
        <button className="btn-accent" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button>
      </div>
    </form>
  );
}

export function SyncingPanel({ lastRunAt, log }: { lastRunAt: string | null; log: { at: string; text: string }[] }) {
  const [pending, start] = useTransition();
  const { toast } = useToast();
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title">Store syncing</h2>
          <p className="mt-1 text-body-sm text-fg-muted">Payments, shipments, tracking, and subscriptions sync automatically from the backend.</p>
          <p className="mt-3 text-caption text-fg-subtle">Last sync: {lastRunAt ? new Date(lastRunAt).toLocaleString('en-IN') : 'Not run yet'}</p>
        </div>
        <button className="btn-accent" disabled={pending} onClick={() => start(async () => toast(await runSyncNow()))}>
          {pending ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <div className="card">
        <h3 className="text-body font-semibold">Recent activity</h3>
        {log.length ? (
          <ul className="mt-3 space-y-2 text-body-sm text-fg-muted">
            {log.slice(0, 12).map((entry) => <li key={`${entry.at}-${entry.text}`}>{new Date(entry.at).toLocaleString('en-IN')} · {entry.text.replaceAll('Automation', 'Sync')}</li>)}
          </ul>
        ) : <p className="mt-2 text-body-sm text-fg-muted">No sync activity yet.</p>}
      </div>
    </div>
  );
}
