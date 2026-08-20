'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

// =========================================================
// Notifications:
//   <NotificationProvider>  — polling, chime, read state
//   <NotificationBell>      — sidebar / topbar trigger
// The panel is a centered modal over a blurred dark backdrop.
// Read state is per-notification (mark one / mark all).
// =========================================================

type PanelEvent = {
  id: string;
  type: 'order' | 'customer' | 'subscription' | 'payment' | 'return' | 'query';
  title: string;
  message: string;
  href: string;
  at: string;
};

const POLL_MS = 5000;
const MAX_READ_IDS = 300;

const TYPE_ICON: Record<PanelEvent['type'], string> = {
  order: 'orders',
  customer: 'users',
  subscription: 'repeat',
  payment: 'card',
  return: 'return',
  query: 'chat',
};

function timeAgo(iso: string) {
  const s = Math.max(Math.floor((Date.now() - new Date(iso).getTime()) / 1000), 0);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Today / Yesterday / Earlier — keeps a 50-deep list scannable. */
function dayGroup(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
}

type NotifApi = {
  events: PanelEvent[];
  unread: number;
  open: boolean;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  toggle: () => void;
  close: () => void;
};

const NotifContext = createContext<NotifApi | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [events, setEvents] = useState<PanelEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  const persistRead = (next: Set<string>) => {
    setReadIds(next);
    void fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ readIds: [...next].slice(-MAX_READ_IDS) }),
    });
  };

  // Unlock audio on the first user gesture (browser autoplay policy).
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        try {
          audioRef.current = new AudioContext();
        } catch {
          /* unsupported */
        }
      }
      audioRef.current?.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const chime = useCallback(() => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const note = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + 0.4);
    };
    note(880, 0);
    note(1318.5, 0.12);
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { events: PanelEvent[]; readIds?: string[] };
        if (!alive) return;
        const fresh =
          knownIds.current !== null ? data.events.filter((e) => !knownIds.current!.has(e.id)) : [];
        knownIds.current = new Set(data.events.map((e) => e.id));
        setEvents(data.events);
        if (data.readIds) setReadIds(new Set(data.readIds));
        if (fresh.length > 0) {
          chime();
          router.refresh();
        }
      } catch {
        /* offline — retry next tick */
      }
    };
    tick();
    const interval = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [chime, router]);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const markRead = useCallback(
    (id: string) => {
      const next = new Set(readIds);
      next.add(id);
      persistRead(next);
    },
    [readIds],
  );

  const markAllRead = useCallback(() => {
    const next = new Set(readIds);
    for (const e of events) next.add(e.id);
    persistRead(next);
  }, [events, readIds]);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  const unread = events.filter((e) => !readIds.has(e.id)).length;

  return (
    <NotifContext.Provider value={{ events, unread, open, isRead, markRead, markAllRead, toggle, close }}>
      {children}
      <NotificationPanel />
    </NotifContext.Provider>
  );
}

function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error('NotificationBell must be used inside NotificationProvider');
  return ctx;
}

/* ----------------------------------------------------------------- bell */

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const { unread, open, toggle } = useNotifications();

  return (
    <button
      type="button"
      onClick={toggle}
      title="Notifications"
      aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
      className={`relative flex items-center rounded-md text-[12px] font-medium transition-colors ${
        compact ? 'mx-auto h-8 w-8 justify-center' : 'w-full gap-2 px-2 py-[5px]'
      } ${open ? 'bg-accent text-accent-ink' : 'text-white/70 hover:bg-white/[0.07] hover:text-white'}`}
    >
      <Icon name="bell" className="h-3.5 w-3.5 shrink-0" />
      {!compact ? <span className="min-w-0 flex-1 truncate text-left">Notifications</span> : null}
      {unread > 0 ? (
        <span
          className={`${
            compact ? 'absolute -right-0.5 -top-0.5' : ''
          } flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
            open ? 'bg-ink text-accent' : 'bg-accent text-accent-ink'
          }`}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------- centered modal panel */

function NotificationPanel() {
  const { events, unread, open, close, isRead, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-enter fixed inset-0 z-[75] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
    >
      {/* Dark, gaussian-blurred backdrop */}
      <button
        aria-label="Close notifications"
        tabIndex={-1}
        className="absolute inset-0 bg-ink/60 backdrop-blur-md"
        onClick={close}
      />

      {/* Fixed frame: header and footer never move; only the list scrolls. */}
      <div className="modal-card relative flex h-[min(76vh,600px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-paper-200 bg-white shadow-pop">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-paper-200 px-5 py-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-title">Notifications</h2>
            {unread > 0 ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold tabular-nums text-accent-ink">
                {unread} new
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-accent-pressed transition-colors hover:bg-accent-soft"
              >
                Mark all as read
              </button>
            ) : null}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-paper-100 hover:text-fg"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List — the only scrolling region; grouped by day, rows fixed-height-ish */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
          {events.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper-100 text-fg-subtle">
                <Icon name="bell" className="h-4 w-4" />
              </span>
              <p className="text-body-sm text-fg-subtle">
                Nothing yet — new orders, returns, subscriptions, customers and payments land here in real time.
              </p>
            </div>
          ) : (
            events.map((e, i) => {
              const read = isRead(e.id);
              const group = dayGroup(e.at);
              const showGroup = i === 0 || dayGroup(events[i - 1].at) !== group;
              return (
                <div key={e.id}>
                  {showGroup ? (
                    <p className="sticky top-0 z-10 -mx-2 border-b border-paper-200 bg-white/95 px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle backdrop-blur-sm">
                      {group}
                    </p>
                  ) : null}
                  <div
                    className={`group mt-1 flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      read ? 'opacity-65 hover:opacity-100' : 'bg-accent-soft/40'
                    } hover:bg-accent-soft/70`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-pressed">
                      <Icon name={TYPE_ICON[e.type]} className="h-3.5 w-3.5" />
                    </span>
                    <Link
                      href={e.href}
                      onClick={() => {
                        markRead(e.id);
                        close();
                      }}
                      className="min-w-0 flex-1 leading-snug"
                    >
                      <span className="flex items-center gap-1.5">
                        {!read ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                        <span className={`block truncate text-[12px] ${read ? 'font-medium' : 'font-semibold'}`}>{e.title}</span>
                      </span>
                      <span className="line-clamp-2 text-[11.5px] text-fg-muted">{e.message}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-fg-subtle">{timeAgo(e.at)}</span>
                    </Link>
                    {!read ? (
                      <button
                        type="button"
                        title="Mark as read"
                        aria-label={`Mark "${e.title}" as read`}
                        onClick={() => markRead(e.id)}
                        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle opacity-0 transition-all hover:bg-white hover:text-accent-pressed group-hover:opacity-100"
                      >
                        <Icon name="check" className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer — count stays visible however long the list gets */}
        {events.length > 0 ? (
          <div className="shrink-0 border-t border-paper-200 bg-paper-100/60 px-5 py-2 text-center text-[10.5px] text-fg-subtle">
            Showing the latest {events.length} notification{events.length === 1 ? '' : 's'}
            {unread > 0 ? ` · ${unread} unread` : ''}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
