import { notFound } from 'next/navigation';
import { requirePermission, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import type { Product } from '@/lib/types';
import { PageHeader, BackLink, Pill } from '@/components/ui';
import { ProductEditor } from './ProductEditor';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('products.view');
  const { id } = await params;

  const products = await readCollection<Product[]>('products');
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

  return (
    <>
      <BackLink href="/products" label="All products" />
      <PageHeader
        kicker={`/${product.slug}`}
        title={product.name}
        actions={<Pill tone={product.status === 'active' ? 'accent' : 'neutral'}>{product.status}</Pill>}
      />
      <ProductEditor product={product} canManage={can(user, 'products.edit')} canDelete={can(user, 'products.delete')} canMedia={can(user, 'products.media')} />
    </>
  );
}
