import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card py-16 text-center">
      <p className="text-caption font-medium mb-2 text-fg-subtle">404</p>
      <h1 className="brand-head text-[1.125rem] mb-3">Nothing here.</h1>
      <p className="text-body-sm mb-6 text-fg-muted">That record doesn’t exist — it may have been deleted.</p>
      <Link href="/" className="btn-accent">
        Back to dashboard
      </Link>
    </div>
  );
}
