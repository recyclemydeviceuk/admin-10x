'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Icon } from '@/components/Icon';

/** Re-fetches the current page's server data — no full reload. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-paper-300 bg-white px-3 py-2 text-[12px] font-medium text-fg-muted transition-colors hover:border-fg-subtle hover:text-fg disabled:opacity-60"
      title="Refresh the list"
    >
      <Icon name="repeat" className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
      {pending ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
