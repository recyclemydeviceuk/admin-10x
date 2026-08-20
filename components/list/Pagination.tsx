'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { PER_PAGE_OPTIONS } from '@/lib/list';

export function Pagination({
  basePath,
  page,
  totalPages,
  total,
  noun = 'results',
}: {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  noun?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (nextPage: number, perPage?: number) => {
    const next = new URLSearchParams(params.toString());
    if (nextPage > 1) next.set('page', String(nextPage));
    else next.delete('page');
    if (perPage) {
      if (perPage !== 10) next.set('per', String(perPage));
      else next.delete('per');
      next.delete('page');
    }
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const perPage = PER_PAGE_OPTIONS.includes(Number(params.get('per')) as (typeof PER_PAGE_OPTIONS)[number])
    ? Number(params.get('per'))
    : 10;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-fg-subtle">
        {total.toLocaleString('en-IN')} {noun}
        {totalPages > 1 ? <span> · page {page} of {totalPages}</span> : null}
      </p>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-[12px] text-fg-subtle">
          Show
          {PER_PAGE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => go(1, n)}
              className={`rounded-md px-2 py-1 font-medium transition-colors ${
                perPage === n ? 'bg-ink text-white' : 'text-fg-muted hover:bg-paper-100'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex items-center overflow-hidden rounded-lg border border-paper-300 bg-white">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
            className="flex h-8 w-8 items-center justify-center text-fg-muted transition-colors hover:bg-paper-100 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Icon name="chevronLeft" className="h-3.5 w-3.5" />
          </button>
          <span className="border-x border-paper-300 bg-ink px-3 py-1.5 text-[12px] font-semibold tabular-nums text-white">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => go(page + 1)}
            aria-label="Next page"
            className="flex h-8 w-8 items-center justify-center text-fg-muted transition-colors hover:bg-paper-100 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Icon name="chevronRight" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
