import type { Product } from '@/lib/types';

/**
 * Best real photo for a line that names a product. Prefers the catalogue
 * linkage (productId), falls back to a name match, then to the only product
 * in a single-product store — so old orders keep a photo even if their
 * linkage predates it.
 */
export function productImageFor(
  products: Product[],
  line: { productId?: string; name?: string },
): string | undefined {
  const byId = line.productId ? products.find((p) => p.id === line.productId) : undefined;
  const byName =
    !byId && line.name
      ? products.find((p) => line.name!.toLowerCase().includes(p.name.toLowerCase()))
      : undefined;
  const product = byId ?? byName ?? (products.length === 1 ? products[0] : undefined);
  return product?.images[0];
}
