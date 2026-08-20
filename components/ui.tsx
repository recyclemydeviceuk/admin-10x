import Link from 'next/link';
import { Icon } from './Icon';
import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { STAGE_LABEL } from '@/lib/types';

/* ------------------------------------------------------------ page header */

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="space-y-1.5">
        {kicker ? <p className="kicker text-accent-pressed">{kicker}</p> : null}
        <h1 className="brand-head text-display">{title}</h1>
        {description ? <p className="max-w-xl text-body text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------ section head */

export function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h2 className="text-title">{title}</h2>
        {sub ? <p className="mt-0.5 text-caption text-fg-subtle">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------------------------------------------- badges */

const STATUS_TONE: Record<OrderStatus, string> = {
  placed: 'bg-paper-100 text-fg-muted',
  confirmed: 'bg-paper-100 text-fg',
  packed: 'bg-paper-100 text-fg',
  shipped: 'bg-accent-soft text-accent-pressed',
  out_for_delivery: 'bg-accent-soft text-accent-pressed',
  delivered: 'bg-accent/20 text-accent-pressed',
  cancelled: 'bg-danger/10 text-danger',
  returned: 'bg-warning/10 text-warning',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-caption font-medium ${STATUS_TONE[status]}`}>
      {STAGE_LABEL[status]}
    </span>
  );
}

const PAY_TONE: Record<PaymentStatus, string> = {
  paid: 'bg-accent/20 text-accent-pressed',
  pending: 'bg-warning/10 text-warning',
  refunded: 'bg-paper-100 text-fg-muted',
  failed: 'bg-danger/10 text-danger',
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-caption font-medium capitalize ${PAY_TONE[status]}`}>
      {status}
    </span>
  );
}

export function Pill({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'accent' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'bg-paper-100 text-fg-muted',
    accent: 'bg-accent/20 text-accent-pressed',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-caption font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ stats */

export function StatCard({
  label,
  value,
  sub,
  trend,
  icon,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon?: string;
  href?: string;
}) {
  const body = (
    <div className={`card flex h-full flex-col justify-between gap-4 p-5 ${href ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-medium text-fg-muted">{label}</p>
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-pressed">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div>
        <p className="brand-head text-[1.375rem] leading-none">{value}</p>
        {/* One reserved line, always — so every card's number sits on the
            same baseline whether it has a trend, a note, both, or neither. */}
        <div className="mt-2 flex h-[22px] items-center gap-2 overflow-hidden whitespace-nowrap">
          {typeof trend === 'number' ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${
                trend >= 0 ? 'bg-accent-soft text-accent-pressed' : 'bg-danger/10 text-danger'
              }`}
            >
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
            </span>
          ) : null}
          {/* A six-across card fits ONE meta item: the trend when there is
              one, the note otherwise. Both squeezed together truncates. */}
          {sub && typeof trend !== 'number' ? <span className="truncate text-caption text-fg-subtle">{sub}</span> : null}
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/* ------------------------------------------------------------------ table */

export function Table({ head, children }: { head: (string | React.ReactNode)[]; children: React.ReactNode }) {
  return (
    <div className="scroll-x card p-0">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-paper-200 bg-paper-100/60">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-subtle first:pl-4 last:pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-200 text-[12px]">{children}</tbody>
      </table>
    </div>
  );
}

/** Compact cell — use for every td in list tables. */
export const td = 'px-3 py-2.5 first:pl-4 last:pr-4 align-middle';

/* ----------------------------------------------------------------- avatar */

const AVATAR_TONES = ['bg-accent-soft text-accent-pressed', 'bg-paper-100 text-fg-muted'];

export function Avatar({ name, seed = 0 }: { name: string; seed?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${AVATAR_TONES[seed % AVATAR_TONES.length]}`}>
      {initials || '—'}
    </span>
  );
}

/**
 * Product thumbnail — the real photo from the catalogue, with the lettered
 * square only as a fallback for a product that has no image yet.
 */
export function ProductThumb({
  src,
  name,
  seed = 0,
  size = 'sm',
}: {
  src?: string;
  name: string;
  seed?: number;
  size?: 'sm' | 'md';
}) {
  const box = size === 'md' ? 'h-11 w-11' : 'h-8 w-8';
  if (!src) {
    return <Avatar name={name} seed={seed} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- catalogue photos live on S3; plain <img> avoids remotePatterns coupling in the panel
    <img
      src={src}
      alt={name}
      className={`${box} shrink-0 rounded-lg border border-paper-200 bg-paper-100 object-cover`}
    />
  );
}

/* -------------------------------------------------------- stacked datetime */

export function DateCell({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-fg-subtle">—</span>;
  const d = new Date(iso);
  return (
    <span className="block whitespace-nowrap leading-tight">
      <span className="block font-medium">
        {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
      <span className="block text-[11px] text-fg-subtle">
        {d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------ empty state */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card py-16 text-center">
      <p className="text-title text-fg-muted">{title}</p>
      {hint ? <p className="mt-2 text-body text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- back link */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-5 inline-flex items-center gap-1.5 text-body-sm font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <Icon name="chevronLeft" className="h-4 w-4" />
      {label}
    </Link>
  );
}
