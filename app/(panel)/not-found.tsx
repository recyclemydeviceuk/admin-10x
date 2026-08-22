import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** 404 inside the panel shell — sidebar stays, so it never feels like a dead end. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="text-caption font-semibold uppercase tracking-[0.16em] text-accent-pressed">404</p>
      <h1 className="brand-head mt-3 text-[2rem]">Nothing here.</h1>
      <p className="mt-3 text-body text-fg-muted">
        That page or record doesn’t exist — it may have been deleted, or the link is out of date.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/orders" className="btn-accent">
          <Icon name="orders" className="h-4 w-4" />
          Go to orders
        </Link>
        <Link href="/" className="btn-outline">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
