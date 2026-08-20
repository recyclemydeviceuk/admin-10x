import Link from 'next/link';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { inr } from '@/lib/format';
import { paginate } from '@/lib/list';
import type { Product } from '@/lib/types';
import { PageHeader, Table, Pill, EmptyState, ProductThumb, DateCell, td } from '@/components/ui';
import { FilterBar } from '@/components/list/FilterBar';
import { Pagination } from '@/components/list/Pagination';
import { NewProductButton } from './NewProductButton';

export const metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

type Params = { q?: string; status?: string; stock?: string; page?: string; per?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePermission('products.view');
  const params = await searchParams;
  const q = (params.q ?? '').trim().toLowerCase();

  let products = await readCollection<Product[]>('products');
  if (params.status) products = products.filter((p) => p.status === params.status);
  if (params.stock === 'low') {
    products = products.filter((p) => p.tiers.some((t) => t.available && t.stock <= t.lowStockAt));
  }
  if (q) {
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }

  const { pageItems, page, totalPages, total } = paginate(products, params.page, params.per);

  return (
    <>
      <PageHeader
        kicker="Store"
        title="Products"
        actions={can(user, 'products.create') ? <NewProductButton /> : undefined}
      />

      <FilterBar
        basePath="/products"
        placeholder="Search name or slug…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
              { value: 'archived', label: 'Archived' },
            ],
          },
          {
            key: 'stock',
            label: 'Stock',
            options: [{ value: 'low', label: 'Low stock' }],
          },
        ]}
      />

      {pageItems.length === 0 ? (
        <EmptyState title="No products match" />
      ) : (
        <Table head={['Product', 'Packs', 'Price', 'Stock', 'Status', 'Updated']}>
          {pageItems.map((p, i) => {
            const available = p.tiers.filter((t) => t.available);
            const totalStock = p.tiers.reduce((s, t) => s + t.stock, 0);
            const low = available.some((t) => t.stock <= t.lowStockAt);
            return (
              <tr key={p.id} className="transition-colors hover:bg-accent-soft/40">
                <td className={td}>
                  <Link href={`/products/${p.id}`} className="flex items-center gap-2.5">
                    <ProductThumb src={p.images[0]} name={p.name} seed={i} />
                    <span className="min-w-0 leading-tight">
                      <span className="block truncate font-semibold hover:text-accent-pressed">{p.name}</span>
                      <span className="block truncate text-[11px] text-fg-subtle">/{p.slug}</span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} text-fg-muted`}>
                  {available.length ? available.map((t) => t.name).join(', ') : 'None on sale'}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  {available[0] ? (
                    <>
                      {inr(available[0].oneTimePrice)}
                      <span className="text-fg-subtle"> / {inr(available[0].subscribePrice)} sub</span>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${td} tabular-nums`}>
                  {totalStock}
                  {low ? <span className="ml-2"><Pill tone="warning">Low</Pill></span> : null}
                </td>
                <td className={td}>
                  <Pill tone={p.status === 'active' ? 'accent' : 'neutral'}>{p.status}</Pill>
                </td>
                <td className={td}><DateCell iso={p.updatedAt} /></td>
              </tr>
            );
          })}
        </Table>
      )}

      <Pagination basePath="/products" page={page} totalPages={totalPages} total={total} noun="products" />
    </>
  );
}
