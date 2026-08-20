'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/** Clickable column header — toggles "field:desc" → "field:asc" in the URL. */
export function SortHeader({
  basePath,
  field,
  children,
}: {
  basePath: string;
  field: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [curField, curDir] = (params.get('sort') ?? '').split(':');
  const active = curField === field;

  const toggle = () => {
    const next = new URLSearchParams(params.toString());
    next.set('sort', `${field}:${active && curDir !== 'asc' ? 'asc' : 'desc'}`);
    next.delete('page');
    router.push(`${basePath}?${next.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`group inline-flex items-center gap-1 uppercase transition-colors hover:text-fg ${active ? 'text-fg' : ''}`}
    >
      {children}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-100" aria-hidden>
        {active ? (
          curDir === 'asc' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />
        ) : (
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        )}
      </svg>
    </button>
  );
}
