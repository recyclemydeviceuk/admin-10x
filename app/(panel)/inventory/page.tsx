import Link from 'next/link';

import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import type { Product } from '@/lib/types';
import { PageHeader, Table, Pill, EmptyState, ProductThumb, td } from '@/components/ui';
import { FilterBar } from '@/components/list/FilterBar';

import { StockRow } from './StockRow';

export const metadata = { title: 'Inventory' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; level?: string };

/**
 * One row per sellable pack, with the stock number editable in place. This is
 * the shelf view — the product editor stays the place for prices and copy.
 */
export default async function InventoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('inventory.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();
  const canEdit = can(user, 'inventory.adjust');

  const products = await readCollection<Product[]>('products');
  let rows = products.flatMap((p, i) =>
    p.tiers.map((t) => ({
      product: p,
      tier: t,
      seed: i,
      state: !t.available ? 'off-sale' : t.stock === 0 ? 'out' : t.stock <= t.lowStockAt ? 'low' : 'ok',
    })),
  );

  const totals = {
    packs: rows.reduce((s, r) => s + (r.tier.available ? r.tier.stock : 0), 0),
    low: rows.filter((r) => r.state === 'low').length,
    out: rows.filter((r) => r.state === 'out').length,
  };

  if (params.level === 'low') rows = rows.filter((r) => r.state === 'low');
  if (params.level === 'out') rows = rows.filter((r) => r.state === 'out');
  if (q) {
    rows = rows.filter(
      (r) => r.product.name.toLowerCase().includes(q) || r.tier.name.toLowerCase().includes(q),
    );
  }

  return (
    <>
      <PageHeader kicker="Store" title="Inventory" />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <StatCard label="Packs in stock" value={String(totals.packs)} />
        <StatCard label="Low stock" value={String(totals.low)} tone={totals.low ? 'warning' : undefined} />
        <StatCard label="Out of stock" value={String(totals.out)} tone={totals.out ? 'danger' : undefined} />
      </div>

      <FilterBar
        basePath="/inventory"
        placeholder="Search product or pack…"
        filters={[
          {
            key: 'level',
            label: 'Level',
            options: [
              { value: 'low', label: 'Low stock' },
              { value: 'out', label: 'Out of stock' },
            ],
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title="Nothing matches" />
      ) : (
        <Table head={['Product', 'Pack', 'Price', 'Level', canEdit ? 'Stock · alert at' : 'Stock']}>
          {rows.map(({ product, tier, seed, state }) => (
            <tr key={`${product.id}-${tier.id}`} className="transition-colors hover:bg-accent-soft/40">
              <td className={td}>
                <Link href={`/products/${product.id}`} className="flex items-center gap-2.5">
                  <ProductThumb src={product.images[0]} name={product.name} seed={seed} />
                  <span className="truncate font-semibold hover:text-accent-pressed">{product.name}</span>
                </Link>
              </td>
              <td className={`${td} whitespace-nowrap text-fg-muted`}>
                {tier.name} · {tier.packets} packets
              </td>
              <td className={`${td} whitespace-nowrap`}>{inr(tier.oneTimePrice)}</td>
              <td className={td}>
                {state === 'off-sale' ? (
                  <Pill tone="neutral">Off sale</Pill>
                ) : state === 'out' ? (
                  <Pill tone="danger">Out of stock</Pill>
                ) : state === 'low' ? (
                  <Pill tone="warning">Low</Pill>
                ) : (
                  <Pill tone="accent">In stock</Pill>
                )}
              </td>
              <td className={td}>
                <StockRow
                  productId={product.id}
                  tierId={tier.id}
                  stock={tier.stock}
                  lowStockAt={tier.lowStockAt}
                  canEdit={canEdit}
                />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'warning' | 'danger' }) {
  return (
    <div className="rounded-2xl border border-paper-200 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-fg'}`}>
        {value}
      </p>
    </div>
  );
}
