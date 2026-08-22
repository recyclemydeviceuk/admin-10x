'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * The panel is live, not manual: every page re-fetches its server data on a
 * short interval while the tab is visible, and immediately when the tab
 * regains focus. `router.refresh()` re-runs the server components only — no
 * reload, no lost scroll, open forms keep their state.
 */
const EVERY_MS = 20_000;

export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') router.refresh();
      }, EVERY_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [router]);

  return null;
}
