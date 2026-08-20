'use client';

import { useEffect, useState } from 'react';

// Hand-rolled SVG charts — smooth curves, soft gradients, hover tooltips.
// Ink + lawn green only.

export type ChartFormat = 'number' | 'inr';

function fullFmt(format: ChartFormat) {
  return (n: number) => (format === 'inr' ? `₹${n.toLocaleString('en-IN')}` : n.toLocaleString('en-IN'));
}

function axisFmt(format: ChartFormat) {
  return (n: number) => {
    const prefix = format === 'inr' ? '₹' : '';
    if (n >= 100000) return `${prefix}${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}k`;
    return `${prefix}${n}`;
  };
}

const ACCENT = '#6DE325';
const ACCENT_DARK = '#4EA310';
const INK = '#0A0C12';
const GRID = '#ECEFEC';
const MUTED = '#98A1AD';

/* --------------------------------------------------------------- helpers */

/** Animates 0 → value on mount so bars/gauges rise into place. */
function useRise(value: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  return v;
}

// Monotone-ish smooth path through points (Catmull-Rom → cubic bezier).
/** What a chart shows before there is anything to chart. */
function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="flex w-full items-center justify-center rounded-lg border border-dashed border-paper-300"
    >
      <p className="text-body-sm text-fg-subtle">No data for this period yet.</p>
    </div>
  );
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

function Tooltip({ x, y, w, lines }: { x: number; y: number; w: number; lines: string[] }) {
  const boxW = Math.max(...lines.map((l) => l.length)) * 6.4 + 20;
  const boxH = lines.length * 16 + 12;
  const left = Math.min(Math.max(x - boxW / 2, 4), w - boxW - 4);
  const top = Math.max(y - boxH - 14, 4);
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={boxW} height={boxH} rx="8" fill={INK} opacity="0.94" />
      {lines.map((line, i) => (
        <text
          key={i}
          x={left + 10}
          y={top + 18 + i * 16}
          fontSize="10.5"
          fontWeight={i === 0 ? 400 : 600}
          fill={i === 0 ? '#B0B5C0' : '#FFFFFF'}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/* ------------------------------------------------------------- area chart */

export function AreaChart({
  points,
  labels,
  height = 240,
  format = 'number',
  seriesName = '',
}: {
  points: number[];
  labels: string[];
  height?: number;
  format?: ChartFormat;
  seriesName?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const drawn = useRise(1);
  const w = 720;
  const h = height;
  const padL = 44;
  const padR = 12;
  const padB = 36;
  const padT = 12;
  // No data yet: say so honestly. Scaling an all-zero series to a ₹1 axis
  // draws gridline labels for money that never existed — which reads as
  // dummy data, because it is.
  const empty = points.every((v) => v === 0);
  if (empty) return <ChartEmpty height={height} />;
  const max = Math.max(...points, 1) * 1.12;
  const x = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);

  const pts = points.map((v, i) => ({ x: x(i), y: y(v) }));
  const line = smoothPath(pts);
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const fmt = fullFmt(format);
  const formatY = axisFmt(format);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label="Trend chart"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * w;
        const idx = Math.round(((px - padL) / (w - padL - padR)) * (points.length - 1));
        setHover(Math.min(Math.max(idx, 0), points.length - 1));
      }}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.32" />
          <stop offset="70%" stopColor={ACCENT} stopOpacity="0.06" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t * max)} y2={y(t * max)} stroke={GRID} strokeWidth="1" />
          {t > 0 ? (
            <text x={padL - 8} y={y(t * max) + 3.5} textAnchor="end" fontSize="10" fill={MUTED}>
              {formatY(Math.round(t * max))}
            </text>
          ) : null}
        </g>
      ))}

      <path
        d={area}
        fill="url(#areaFill)"
        style={{ opacity: drawn, transition: 'opacity 800ms ease 300ms' }}
      />
      <path
        d={line}
        fill="none"
        stroke={ACCENT_DARK}
        strokeWidth="2.25"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - drawn}
        style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.22, 0.8, 0.36, 1)' }}
      />

      {points.map((v, i) => {
        // Thin the axis labels — every label still shows in the tooltip.
        const step = Math.max(Math.ceil(points.length / 7), 1);
        if (i % step !== 0 || !labels[i]) return null;
        return (
          <text key={i} x={x(i)} y={h - 10} textAnchor="middle" fontSize="10" fill={MUTED}>
            {labels[i]}
          </text>
        );
      })}

      {hover !== null ? (
        <>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(0)} stroke={INK} strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
          <circle cx={x(hover)} cy={y(points[hover])} r="5" fill="#fff" stroke={ACCENT_DARK} strokeWidth="2.5" />
          <Tooltip
            x={x(hover)}
            y={y(points[hover])}
            w={w}
            lines={[labels[hover] || '', `${seriesName ? seriesName + ' ' : ''}${fmt(points[hover])}`]}
          />
        </>
      ) : null}
    </svg>
  );
}

/* -------------------------------------------------------------- bar chart */

export function BarChart({
  data,
  height = 240,
  format = 'number',
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: ChartFormat;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const rise = useRise(1);
  const w = 720;
  const h = height;
  const padL = 44;
  const padR = 12;
  const padB = 36;
  const padT = 12;
  const empty = data.every((d) => d.value === 0);
  if (empty) return <ChartEmpty height={height} />;
  const max = Math.max(...data.map((d) => d.value), 1) * 1.12;
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const bw = (w - padL - padR) / Math.max(data.length, 1);
  const fmt = fullFmt(format);
  const formatY = axisFmt(format);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Bar chart" onPointerLeave={() => setHover(null)}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - padR} y1={y(t * max)} y2={y(t * max)} stroke={GRID} strokeWidth="1" />
          {t > 0 ? (
            <text x={padL - 8} y={y(t * max) + 3.5} textAnchor="end" fontSize="10" fill={MUTED}>
              {formatY(Math.round(t * max))}
            </text>
          ) : null}
        </g>
      ))}
      {data.map((d, i) => {
        const bx = padL + i * bw + bw * 0.22;
        const bh = Math.max(y(0) - y(d.value), d.value > 0 ? 3 : 0);
        const active = hover === i;
        return (
          <g key={`${d.label}-${i}`} onPointerEnter={() => setHover(i)}>
            {/* invisible hit area for easy hovering */}
            <rect x={padL + i * bw} y={padT} width={bw} height={h - padT - padB} fill="transparent" />
            <rect
              x={bx}
              y={y(d.value)}
              width={bw * 0.56}
              height={bh}
              rx={Math.min(6, bw * 0.28)}
              fill={active ? ACCENT_DARK : ACCENT}
              className="transition-colors duration-100"
              style={{
                transform: `scaleY(${rise})`,
                transformOrigin: `${bx + bw * 0.28}px ${y(0)}px`,
                transition: `transform 650ms cubic-bezier(0.22, 0.8, 0.36, 1) ${Math.min(i * 18, 350)}ms`,
              }}
            />
            {i % Math.max(Math.ceil(data.length / 8), 1) === 0 ? (
              <text x={padL + i * bw + bw / 2} y={h - 10} textAnchor="middle" fontSize="10" fill={MUTED}>
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {hover !== null ? (
        <Tooltip
          x={padL + hover * bw + bw / 2}
          y={y(data[hover].value)}
          w={w}
          lines={[data[hover].label, fmt(data[hover].value)]}
        />
      ) : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ donut */

const DONUT_SHADES = ['#6DE325', '#4EA310', '#0A0C12', '#98A1AD', '#DDE2DD', '#D97706', '#DC2626'];

export function Donut({
  data,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number }[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const sweep = useRise(1);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const active = hover !== null ? data[hover] : null;

  return (
    <div className="flex flex-col items-stretch gap-5">
      <div className="relative mx-auto h-[148px] w-[148px] shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" role="img" aria-label="Breakdown">
          <circle cx="80" cy="80" r={R} fill="none" stroke={GRID} strokeWidth="16" />
          {data.map((d, i) => {
            const frac = d.value / total;
            const el = (
              <circle
                key={`${d.label}-${i}`}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={DONUT_SHADES[i % DONUT_SHADES.length]}
                strokeWidth={hover === i ? 20 : 16}
                strokeDasharray={`${Math.max(frac * C * sweep - 2, 0.1)} ${C}`}
                strokeDashoffset={-offset * C * sweep}
                strokeLinecap="butt"
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.22, 0.8, 0.36, 1), stroke-dashoffset 900ms cubic-bezier(0.22, 0.8, 0.36, 1), stroke-width 150ms' }}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              />
            );
            offset += frac;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-[22%] flex flex-col items-center justify-center text-center">
          <p className="w-full truncate text-[1.05rem] font-semibold leading-none tabular-nums text-ink">
            {active ? `${Math.round((active.value / total) * 100)}%` : centerValue}
          </p>
          <p className="mt-1.5 w-full truncate text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
            {active ? active.label : centerLabel ?? ''}
          </p>
        </div>
      </div>
      <ul className="w-full space-y-1.5">
        {data.map((d, i) => (
          <li
            key={`${d.label}-${i}`}
            className={`flex cursor-default items-center gap-2.5 rounded-md px-1 py-1 text-body transition-colors ${hover === i ? 'bg-accent-soft' : ''}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DONUT_SHADES[i % DONUT_SHADES.length] }} />
            <span className="min-w-0 flex-1 truncate text-fg-muted">{d.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{d.value}</span>
            <span className="w-9 shrink-0 text-right text-caption tabular-nums text-fg-subtle">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------------------------- horizontal ranking */

export function RankBars({
  data,
  format = 'number',
}: {
  data: { label: string; value: number; sub?: string }[];
  format?: ChartFormat;
}) {
  const formatValue = fullFmt(format);
  const max = Math.max(...data.map((d) => d.value), 1);
  const rise = useRise(1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li
          key={`${d.label}-${i}`}
          className={`-mx-2 cursor-default rounded-lg px-2 py-1 transition-colors ${hover === i ? 'bg-accent-soft/60' : ''}`}
          onPointerEnter={() => setHover(i)}
          onPointerLeave={() => setHover(null)}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-body">
            <span className={`min-w-0 truncate ${hover === i ? 'font-semibold' : 'font-medium'}`}>{d.label}</span>
            <span className="shrink-0 font-semibold">
              {formatValue(d.value)}
              <span className="ml-1.5 text-[10.5px] font-normal text-fg-subtle">{Math.round((d.value / max) * 100)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-paper-100">
            <div
              className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
              style={{ width: `${Math.max((d.value / max) * 100, 2) * rise}%`, filter: hover === i ? 'brightness(0.9)' : undefined }}
            />
          </div>
          {d.sub ? <p className="mt-1 text-caption text-fg-subtle">{d.sub}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- sparkline */

export function Sparkline({ points, width = 120, height = 36 }: { points: number[]; width?: number; height?: number }) {
  const max = Math.max(...points, 1);
  const pts = points.map((v, i) => ({
    x: (i / Math.max(points.length - 1, 1)) * (width - 4) + 2,
    y: 3 + (1 - v / max) * (height - 6),
  }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-full" aria-hidden>
      <path d={smoothPath(pts)} fill="none" stroke={ACCENT_DARK} strokeWidth="1.75" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1]?.x} cy={pts[pts.length - 1]?.y} r="2.5" fill={ACCENT_DARK} />
    </svg>
  );
}

/* -------------------------------------------------------------- funnel */

export function Funnel({
  stages,
  format = 'number',
}: {
  stages: { label: string; value: number }[];
  format?: ChartFormat;
}) {
  const max = Math.max(stages[0]?.value ?? 0, 1);
  const fmt = fullFmt(format);
  const rise = useRise(1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-2.5">
      {stages.map((stage, i) => {
        const pct = Math.round((stage.value / max) * 100);
        const drop = i > 0 && stages[i - 1].value > 0
          ? Math.round(((stages[i - 1].value - stage.value) / stages[i - 1].value) * 100)
          : 0;
        const active = hover === i;
        return (
          <li
            key={stage.label}
            className={`-mx-2 cursor-default rounded-lg px-2 py-1 transition-colors ${active ? 'bg-accent-soft/60' : ''}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
              <span className={active ? 'font-semibold' : 'font-medium'}>{stage.label}</span>
              <span className="shrink-0 text-fg-muted">
                <span className="font-semibold text-fg">{fmt(stage.value)}</span>
                <span className="ml-1.5 text-[10.5px] text-fg-subtle">{pct}%</span>
                {drop > 0 ? <span className="ml-1.5 text-[10.5px] text-danger">−{drop}%</span> : null}
              </span>
            </div>
            <div className="h-5 overflow-hidden rounded-md bg-paper-100">
              <div
                className="flex h-full items-center rounded-md pl-2 transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(pct, 3) * rise}%`,
                  background: `color-mix(in srgb, ${ACCENT} ${100 - i * 14}%, ${ACCENT_DARK})`,
                  filter: active ? 'brightness(0.92)' : undefined,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------- radial gauge */

export function Radial({
  percent,
  label,
  sub,
  stacked = false,
}: {
  percent: number; // 0–100
  label: string;
  sub?: string;
  /** Gauge above its caption — for narrow columns where side-by-side wraps. */
  stacked?: boolean;
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const animated = useRise(clamped);
  const [hover, setHover] = useState(false);
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div
      className={stacked ? 'flex flex-col items-center gap-2 text-center' : 'flex items-center gap-5'}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <svg viewBox="0 0 128 128" className="h-28 w-28 shrink-0" role="img" aria-label={`${label}: ${Math.round(clamped)}%`}>
        <circle cx="64" cy="64" r={R} fill="none" stroke={GRID} strokeWidth={hover ? 14 : 12} className="transition-all duration-200" />
        <circle
          cx="64"
          cy="64"
          r={R}
          fill="none"
          stroke={ACCENT}
          strokeWidth={hover ? 14 : 12}
          strokeLinecap="round"
          strokeDasharray={`${(animated / 100) * C} ${C}`}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1), stroke-width 0.2s' }}
        />
        <text x="64" y="62" textAnchor="middle" fontSize="24" fontWeight="700" fontStyle="italic" fontFamily="var(--font-quantico)" fill={INK}>
          {Math.round(clamped)}%
        </text>
        <text x="64" y="80" textAnchor="middle" fontSize="8" letterSpacing="1" fill={MUTED}>
          {label.toUpperCase().slice(0, 18)}
        </text>
      </svg>
      {sub ? <p className="min-w-0 text-[12px] leading-relaxed text-fg-muted">{sub}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------- calendar heat */

export function CalendarHeat({
  days,
  format = 'number',
}: {
  days: { date: string; label: string; value: number }[];
  format?: ChartFormat;
}) {
  const fmt = fullFmt(format);
  const [hover, setHover] = useState<{ label: string; value: number; x: number; y: number } | null>(null);
  const max = Math.max(...days.map((d) => d.value), 1);
  // Column per week, row per weekday (Mon top) — grid stretches to fill the card.
  const weeks: ({ date: string; label: string; value: number } | null)[][] = [];
  let current: ({ date: string; label: string; value: number } | null)[] = [];
  for (const day of days) {
    const idx = (new Date(day.date).getDay() + 6) % 7;
    if (idx === 0 && current.length > 0) {
      weeks.push(current);
      current = [];
    }
    while (current.length < idx) current.push(null);
    current.push(day);
  }
  if (current.length > 0) {
    while (current.length < 7) current.push(null);
    weeks.push(current);
  }

  const shade = (v: number) => {
    if (v === 0) return '#F0F2F0';
    const t = v / max;
    if (t < 0.25) return '#DCF7C6';
    if (t < 0.5) return '#B7EF87';
    if (t < 0.75) return '#8BE84B';
    return ACCENT_DARK;
  };

  // Short ranges get bigger cells so the block holds its own in the card.
  const cell = weeks.length <= 7 ? 26 : weeks.length <= 14 ? 20 : 16;
  const best = days.reduce((a, b) => (b.value > a.value ? b : a), days[0]);
  const activeDays = days.filter((d) => d.value > 0).length;
  const avg = Math.round(days.reduce((sum, d) => sum + d.value, 0) / Math.max(days.length, 1));

  return (
    <div className="relative flex h-full flex-col">
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-[11px] font-medium text-white shadow-pop"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <span className="text-white/60">{hover.label}</span> · {fmt(hover.value)}
        </div>
      ) : null}

      <div className="scroll-x my-auto flex w-full justify-center gap-2 py-3">
        <div className="grid shrink-0 grid-rows-7 gap-1 text-[9px] leading-none text-fg-subtle">
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
            <span key={i} className="flex h-full items-center">{d}</span>
          ))}
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, ${cell}px)` }}
          onPointerLeave={() => setHover(null)}
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-rows-7 gap-1">
              {Array.from({ length: 7 }, (_, di) => {
                const day = week[di];
                if (!day) return <span key={di} style={{ height: cell, width: cell }} className="rounded-[4px]" />;
                return (
                  <button
                    key={di}
                    type="button"
                    tabIndex={-1}
                    aria-label={`${day.label}: ${fmt(day.value)}`}
                    onPointerEnter={(e) => {
                      const cell = e.currentTarget.getBoundingClientRect();
                      const wrap = e.currentTarget.closest('.relative')!.getBoundingClientRect();
                      setHover({
                        label: day.label,
                        value: day.value,
                        x: cell.left - wrap.left + cell.width / 2,
                        y: cell.top - wrap.top,
                      });
                    }}
                    className="cursor-default rounded-[4px] transition-transform duration-100 hover:scale-125 hover:ring-2 hover:ring-ink/20"
                    style={{ background: shade(day.value), height: cell, width: cell }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-fg-subtle">
        Less
        {['#F0F2F0', '#DCF7C6', '#B7EF87', '#8BE84B', ACCENT_DARK].map((c) => (
          <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
        ))}
        More
      </div>

      {/* Insights footer — the card's height carries information, not air. */}
      <dl className="mt-4 space-y-2 border-t border-paper-200 pt-4 text-[12px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">Best day</dt>
          <dd className="text-right font-semibold">
            {best?.label ?? '—'}
            <span className="ml-1.5 font-normal text-fg-subtle">{best ? fmt(best.value) : ''}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">Daily average</dt>
          <dd className="font-semibold">{fmt(avg)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-muted">Days with sales</dt>
          <dd className="font-semibold">
            {activeDays} of {days.length}
            <span className="ml-1.5 font-normal text-fg-subtle">{Math.round((activeDays / Math.max(days.length, 1)) * 100)}%</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------- this-vs-last compare */

export function CompareBars({
  rows,
  format = 'number',
}: {
  rows: { label: string; current: number; previous: number }[];
  format?: ChartFormat;
}) {
  const fmt = fullFmt(format);
  const rise = useRise(1);
  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const max = Math.max(row.current, row.previous, 1);
        const change = row.previous === 0 ? (row.current > 0 ? 100 : 0) : ((row.current - row.previous) / row.previous) * 100;
        return (
          <li key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
              <span className="font-medium">{row.label}</span>
              <span className={`text-[11px] font-semibold ${change >= 0 ? 'text-accent-pressed' : 'text-danger'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-3.5 flex-1 overflow-hidden rounded-md bg-paper-100">
                  <div className="h-full rounded-md bg-accent transition-all duration-700 ease-out" style={{ width: `${(row.current / max) * 100 * rise}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] font-semibold tabular-nums">{fmt(row.current)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3.5 flex-1 overflow-hidden rounded-md bg-paper-100">
                  <div className="h-full rounded-md bg-paper-300 transition-all duration-700 ease-out" style={{ width: `${(row.previous / max) * 100 * rise}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-fg-subtle">{fmt(row.previous)}</span>
              </div>
            </div>
          </li>
        );
      })}
      <li className="flex items-center gap-4 pt-1 text-[10px] text-fg-subtle">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> This period</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-paper-300" /> Previous period</span>
      </li>
    </ul>
  );
}
