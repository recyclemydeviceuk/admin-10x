// Shared list-page helpers: server-side pagination + sorting over URL params.

export const PER_PAGE_OPTIONS = [10, 25, 50] as const;

export type Paged<T> = {
  pageItems: T[];
  page: number;
  perPage: number;
  totalPages: number;
  total: number;
};

export function paginate<T>(items: T[], pageParam?: string, perPageParam?: string): Paged<T> {
  const perPage = PER_PAGE_OPTIONS.includes(Number(perPageParam) as (typeof PER_PAGE_OPTIONS)[number])
    ? Number(perPageParam)
    : 10;
  const total = items.length;
  const totalPages = Math.max(Math.ceil(total / perPage), 1);
  const page = Math.min(Math.max(Number(pageParam) || 1, 1), totalPages);
  return {
    pageItems: items.slice((page - 1) * perPage, page * perPage),
    page,
    perPage,
    totalPages,
    total,
  };
}

/* ---------------------------------------------------------- date filter */

export const DATE_FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'Lifetime' },
];

/** True when `iso` falls inside the ?date= range (no param or 'all' = everything). */
export function matchesDate(iso: string | null | undefined, dateParam: string | undefined): boolean {
  if (!dateParam || dateParam === 'all') return true;
  if (!iso) return false;
  const days = dateParam === 'today' ? 0 : dateParam === '7d' ? 6 : dateParam === '30d' ? 29 : dateParam === '90d' ? 89 : null;
  if (days === null) return true;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return new Date(iso) >= start;
}

/** Sort direction from a "field:dir" sort param; returns [field, 1|-1]. */
export function parseSort(sortParam: string | undefined, fallbackField: string, fallbackDir: 1 | -1 = -1): [string, 1 | -1] {
  if (!sortParam) return [fallbackField, fallbackDir];
  const [field, dir] = sortParam.split(':');
  return [field || fallbackField, dir === 'asc' ? 1 : -1];
}
