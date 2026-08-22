'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * A page inside the panel threw. Most often the API was unreachable for a
 * moment (the host waking up) — so the first button simply re-renders the
 * route. Sidebar and shell stay in place.
 */
export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[panel] page error', error);
  }, [error]);

  const unreachable = /reach the 10X API|fetch failed|ECONNREFUSED|network/i.test(error.message);

  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="text-caption font-semibold uppercase tracking-[0.16em] text-accent-pressed">
        {unreachable ? 'API unreachable' : 'Something went wrong'}
      </p>
      <h1 className="brand-head mt-3 text-[2rem]">{unreachable ? 'The API didn’t answer.' : 'That page didn’t load.'}</h1>
      <p className="mt-3 text-body text-fg-muted">
        {unreachable
          ? 'The backend may be waking up or restarting. Nothing was changed — try again in a moment.'
          : error.message || 'An unexpected error stopped this page from rendering. Nothing was changed.'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-accent">
          Try again
        </button>
        <Link href="/" className="btn-outline">
          Dashboard
        </Link>
      </div>
      {error.digest ? <p className="mt-6 text-caption text-fg-subtle">Reference {error.digest}</p> : null}
    </div>
  );
}
