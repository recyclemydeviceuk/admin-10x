'use client';

import { useState } from 'react';

import { Select } from '@/components/Select';
import { Icon } from '@/components/Icon';
import { SOCIAL_ICON_PATHS, SOCIAL_PLATFORMS, type SocialLink, type SocialPlatform } from '@/lib/social-icons';

/**
 * The footer's social icons, editable. Pick a platform (its icon comes with
 * it), paste the link, reorder. "Other link" takes a label of its own. The
 * whole list is posted as one JSON field with the store form.
 */
export function SocialLinksEditor({ initial, disabled }: { initial: SocialLink[]; disabled: boolean }) {
  const [links, setLinks] = useState<SocialLink[]>(initial);

  const update = (i: number, patch: Partial<SocialLink>) =>
    setLinks((cur) => cur.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, dir: -1 | 1) =>
    setLinks((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setLinks((cur) => cur.filter((_, j) => j !== i));
  const add = () => {
    const used = new Set(links.map((l) => l.platform));
    const platform = (SOCIAL_PLATFORMS.find((p) => p.id !== 'custom' && !used.has(p.id))?.id ?? 'custom') as SocialPlatform;
    setLinks((cur) => [...cur, { platform, label: '', url: '' }]);
  };

  return (
    <div>
      <input type="hidden" name="socialLinks" value={JSON.stringify(links)} />

      {links.length === 0 ? (
        <p className="rounded-lg bg-paper-100 px-3.5 py-2.5 text-caption text-fg-muted">No social links yet — only the support email shows in the footer.</p>
      ) : (
        <ul className="space-y-3">
          {links.map((link, i) => {
            const meta = SOCIAL_PLATFORMS.find((p) => p.id === link.platform);
            return (
              <li key={i} className="grid items-center gap-3 rounded-xl border border-paper-200 p-3 sm:grid-cols-[auto_180px_1fr_auto]">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={SOCIAL_ICON_PATHS[link.platform] ?? SOCIAL_ICON_PATHS.custom} /></svg>
                </span>
                <div>
                  <Select
                    id={`social-platform-${i}`}
                    options={SOCIAL_PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
                    value={link.platform}
                    onChange={(v) => update(i, { platform: v as SocialPlatform, label: v === 'custom' ? link.label : '' })}
                    disabled={disabled}
                  />
                  {link.platform === 'custom' ? (
                    <input
                      className="field-input mt-2"
                      placeholder="Label, e.g. Blog"
                      value={link.label}
                      disabled={disabled}
                      onChange={(e) => update(i, { label: e.target.value })}
                    />
                  ) : null}
                </div>
                <input
                  className="field-input"
                  type="url"
                  placeholder={meta?.placeholder ?? 'https://…'}
                  value={link.url}
                  disabled={disabled}
                  onChange={(e) => update(i, { url: e.target.value })}
                />
                <div className="flex items-center gap-1">
                  <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} title="Move up" className="rounded-md p-1.5 text-fg-muted hover:bg-paper-100 hover:text-fg disabled:opacity-30">
                    <Icon name="chevronLeft" className="h-4 w-4 rotate-90" />
                  </button>
                  <button type="button" disabled={disabled || i === links.length - 1} onClick={() => move(i, 1)} title="Move down" className="rounded-md p-1.5 text-fg-muted hover:bg-paper-100 hover:text-fg disabled:opacity-30">
                    <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
                  </button>
                  <button type="button" disabled={disabled} onClick={() => remove(i)} title="Remove" className="rounded-md p-1.5 text-danger/70 hover:bg-danger/10 hover:text-danger disabled:opacity-30">
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!disabled && links.length < 12 ? (
        <button type="button" onClick={add} className="btn-outline mt-3">
          <Icon name="plus" className="h-4 w-4" />
          Add a link
        </button>
      ) : null}
    </div>
  );
}
