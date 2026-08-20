'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

export function Select({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Choose…',
  name,
  id,
}: {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxH: 280, openUp: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const selected = options.find((o) => o.value === value);

  const place = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxH = 280;
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    setPos({
      top: openUp ? Math.max(8, r.top - maxH - gap) : r.bottom + gap,
      left: r.left,
      width: r.width,
      maxH: Math.min(maxH, openUp ? spaceAbove : spaceBelow),
      openUp,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onReposition = () => place();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    });
  }, [open, options, value]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open && highlight >= 0) commit(highlight);
      else setOpen(true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    }
  };

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: Math.max(pos.width, 180),
              maxHeight: Math.max(pos.maxH, 120),
            }}
            className="z-[90] overflow-y-auto rounded-xl border border-paper-200 bg-white p-1.5 shadow-pop"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlight;
              return (
                <li key={opt.value} role="option" aria-selected={isSelected} data-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => commit(idx)}
                    onMouseEnter={() => setHighlight(idx)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-body transition-colors duration-100
                      ${isHighlighted ? 'bg-accent-soft' : 'bg-white'}
                      ${isSelected ? 'font-semibold text-fg' : 'text-fg-muted'}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.hint ? <span className="block truncate text-caption text-fg-subtle">{opt.hint}</span> : null}
                    </span>
                    {isSelected ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#4EA310"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 shrink-0"
                        aria-hidden
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-white px-3.5 py-2.5 text-left text-body transition-all duration-150
          ${open ? 'border-accent-pressed ring-2 ring-accent/25' : 'border-paper-300 hover:border-fg-subtle'}
          ${disabled ? 'cursor-not-allowed border-paper-200 text-fg-subtle' : 'text-fg'}
          focus-visible:outline-none focus-visible:border-accent-pressed focus-visible:ring-2 focus-visible:ring-accent/25`}
      >
        <span className={selected ? 'truncate font-medium' : 'truncate text-fg-subtle'}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 shrink-0 text-fg-subtle transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
