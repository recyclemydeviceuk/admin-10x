'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { DATE_FILTER_OPTIONS } from '@/lib/list';

export type FilterDef = {
  key: string; // URL param
  label: string; // shown when nothing selected
  options: { value: string; label: string }[];
};

// One compact dropdown per filter — closed by default, styled like the
// reference toolbar. Choosing an option updates the URL (server refilters).
function FilterDropdown({
  def,
  value,
  onSelect,
}: {
  def: FilterDef;
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = def.options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
          active
            ? 'border-accent-pressed bg-accent-soft text-accent-pressed'
            : 'border-paper-300 bg-white text-fg-muted hover:border-fg-subtle hover:text-fg'
        }`}
      >
        {active ? `${def.label}: ${active.label}` : def.label}
        <Icon name="chevronRight" className={`h-3 w-3 transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>
      {open ? (
        <ul className="absolute left-0 z-50 mt-1.5 min-w-44 rounded-xl border border-paper-200 bg-white p-1 shadow-pop">
          <li>
            <button
              type="button"
              onClick={() => {
                onSelect('');
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-[12px] transition-colors hover:bg-accent-soft ${!value ? 'font-semibold' : 'text-fg-muted'}`}
            >
              All
            </button>
          </li>
          {def.options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[12px] transition-colors hover:bg-accent-soft ${
                  value === opt.value ? 'font-semibold' : 'text-fg-muted'
                }`}
              >
                {opt.label}
                {value === opt.value ? <Icon name="check" className="h-3.5 w-3.5 text-accent-pressed" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FilterBar({
  basePath,
  placeholder = 'Search…',
  filters = [],
  withDate = false,
  dateLabel = 'Date',
}: {
  basePath: string;
  placeholder?: string;
  filters?: FilterDef[];
  /** Adds a date-range dropdown bound to ?date= (today / 7d / 30d / 90d). */
  withDate?: boolean;
  dateLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  // Keep the box in sync when the URL changes from elsewhere (clear, back).
  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const push = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete('page'); // any filter/search change restarts at page 1
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  // Debounced live search.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      push((next) => {
        if (value.trim()) next.set('q', value.trim());
        else next.delete('q');
      });
    }, 350);
  };

  const allFilters: FilterDef[] = withDate
    ? [...filters, { key: 'date', label: dateLabel, options: DATE_FILTER_OPTIONS }]
    : filters;

  const hasAnyFilter = Boolean(params.get('q')) || allFilters.some((f) => params.get(f.key));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-paper-300 bg-white py-2 pl-9 pr-3 text-[12px] outline-none transition-colors placeholder:text-fg-subtle hover:border-fg-subtle focus:border-accent-pressed focus:ring-2 focus:ring-accent/25"
        />
      </div>

      {allFilters.map((def) => (
        <FilterDropdown
          key={def.key}
          def={def}
          value={params.get(def.key) ?? ''}
          onSelect={(value) =>
            push((next) => {
              if (value) next.set(def.key, value);
              else next.delete(def.key);
            })
          }
        />
      ))}

      {hasAnyFilter ? (
        <button
          type="button"
          onClick={() => router.push(basePath)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-medium text-fg-subtle transition-colors hover:text-danger"
        >
          <Icon name="x" className="h-3 w-3" />
          Clear
        </button>
      ) : null}

    </div>
  );
}
