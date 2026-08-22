import Link from 'next/link';

/** Unknown URLs outside the panel shell (e.g. a mistyped /login path). */
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-50 px-6">
      <div className="card max-w-md text-center">
        <p className="text-caption font-semibold uppercase tracking-[0.16em] text-accent-pressed">404</p>
        <h1 className="brand-head mt-3 text-[1.75rem]">Nothing here.</h1>
        <p className="mt-3 text-body-sm text-fg-muted">That page doesn’t exist in the 10X admin panel.</p>
        <Link href="/" className="btn-accent mt-6 inline-flex">
          Open the panel
        </Link>
      </div>
    </main>
  );
}
