'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readCollection, writeCollection, newId } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import { DEFAULT_STOREFRONT, type Product, type ProductTier } from '@/lib/types';
import type { ActionResult } from './orders';

export async function saveProduct(productId: string, formData: FormData): Promise<ActionResult> {
  await assertPermission('products.edit');
  const products = await readCollection<Product[]>('products');
  const product = products.find((p) => p.id === productId);
  if (!product) return { ok: false, message: 'Product not found.' };

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, message: 'The product needs a name.' };

  product.name = name;
  product.tagline = String(formData.get('tagline') ?? '').trim();
  product.description = String(formData.get('description') ?? '').trim();
  product.status = (formData.get('status') as Product['status']) || 'active';
  product.video = String(formData.get('video') ?? '').trim();
  product.seo = {
    title: String(formData.get('seoTitle') ?? '').trim(),
    description: String(formData.get('seoDescription') ?? '').trim(),
  };

  // Gallery arrives as one hidden input per image, in display order.
  product.images = formData.getAll('images[]').map((v) => String(v).trim()).filter(Boolean);
  // The dark set is optional — an empty list means "reuse the light photos",
  // which is what the storefront falls back to.
  product.imagesDark = formData.getAll('imagesDark[]').map((v) => String(v).trim()).filter(Boolean);

  // Tier rows: `tierIds` lists row ids in order; each row's fields are
  // namespaced tier.<rowId>.<key>. Rows with an id starting "new-" are
  // additions; existing tier ids not listed were removed in the editor.
  const rowIds = String(formData.get('tierIds') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (rowIds.length === 0) return { ok: false, message: 'A product needs at least one pack.' };

  const tiers: ProductTier[] = [];
  for (const rowId of rowIds) {
    const g = (key: string) => formData.get(`tier.${rowId}.${key}`);
    const packets = Number(g('packets'));
    const oneTime = Number(g('oneTimePrice'));
    const subscribe = Number(g('subscribePrice'));
    const stock = Number(g('stock'));
    const tierName = String(g('name') ?? '').trim() || `${packets} Pack`;

    if (!Number.isFinite(packets) || packets <= 0) {
      return { ok: false, message: `${tierName}: packet count must be a positive number.` };
    }
    if (!Number.isFinite(oneTime) || oneTime <= 0 || !Number.isFinite(subscribe) || subscribe <= 0) {
      return { ok: false, message: `${tierName}: prices must be positive numbers.` };
    }
    if (!Number.isFinite(stock) || stock < 0) {
      return { ok: false, message: `${tierName}: stock can't be negative.` };
    }

    const isNew = rowId.startsWith('new-');
    let id = isNew ? `${packets}-pack` : rowId;
    while (tiers.some((t) => t.id === id)) id = `${id}-x`;

    tiers.push({
      id,
      name: tierName,
      packets,
      oneTimePrice: oneTime,
      subscribePrice: subscribe,
      stock,
      lowStockAt: Math.max(Number(g('lowStockAt')) || 0, 0),
      available: g('available') === 'on',
    });
  }
  if (!tiers.some((t) => t.available) && product.status === 'active') {
    return { ok: false, message: 'An active product needs at least one pack on sale.' };
  }
  product.tiers = tiers;

  // Storefront hero copy — bullet pointers arrive as benefits[] in order.
  product.storefront = {
    kicker: String(formData.get('sfKicker') ?? '').trim(),
    subscriptionNote: String(formData.get('sfSubscriptionNote') ?? '').trim(),
    priceNote: String(formData.get('sfPriceNote') ?? '').trim() || DEFAULT_STOREFRONT.priceNote,
    subscribePriceNote:
      String(formData.get('sfSubscribePriceNote') ?? '').trim() || DEFAULT_STOREFRONT.subscribePriceNote,
    ctaLabel: String(formData.get('sfCtaLabel') ?? '').trim() || DEFAULT_STOREFRONT.ctaLabel,
    perfectFor: String(formData.get('sfPerfectFor') ?? '').trim(),
    benefits: formData
      .getAll('benefits[]')
      .map((v) => String(v).trim())
      .filter(Boolean),
  };
  product.updatedAt = new Date().toISOString();

  await writeCollection('products', products);
  revalidatePath('/products');
  revalidatePath(`/products/${productId}`);
  return { ok: true, message: 'Product saved. The storefront picks this up on its next fetch.' };
}

/** New product — starts as a draft with one pack, then opens the editor. */
export async function createProduct(formData: FormData): Promise<never | ActionResult> {
  await assertPermission('products.create');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, message: 'Give the product a name.' };

  const products = await readCollection<Product[]>('products');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (products.some((p) => p.slug === slug)) {
    return { ok: false, message: 'A product with that name already exists.' };
  }

  const product: Product = {
    id: newId('prod'),
    slug,
    name,
    tagline: '',
    description: '',
    status: 'draft',
    images: [],
    imagesDark: [],
    video: '',
    // No packs and no prices. A draft that arrives pre-filled with numbers
    // nobody chose is how an invented price reaches the storefront — the
    // editor's "Add pack" is where the real ones get entered.
    tiers: [],
    seo: { title: name, description: '' },
    updatedAt: new Date().toISOString(),
  };
  products.push(product);
  await writeCollection('products', products);
  revalidatePath('/products');
  redirect(`/products/${product.id}`);
}

/** Delete a product outright. Archive (status) is the softer option. */
export async function deleteProduct(productId: string): Promise<ActionResult> {
  await assertPermission('products.delete');
  const products = await readCollection<Product[]>('products');
  const idx = products.findIndex((p) => p.id === productId);
  if (idx === -1) return { ok: false, message: 'Product not found.' };
  if (products.length === 1) {
    return { ok: false, message: 'This is the only product — archive it instead of deleting.' };
  }
  const [removed] = products.splice(idx, 1);
  await writeCollection('products', products);
  revalidatePath('/products');
  return { ok: true, message: `${removed.name} deleted.` };
}

/**
 * Inventory page: set one pack's stock level and alert threshold in place.
 * Everything else about the product is left exactly as it was.
 */
export async function setTierStock(productId: string, tierId: string, formData: FormData): Promise<ActionResult> {
  await assertPermission('inventory.adjust');
  const stock = Number(formData.get('stock'));
  const lowStockAt = Number(formData.get('lowStockAt'));
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, message: 'Stock must be a whole number, 0 or more.' };
  if (!Number.isInteger(lowStockAt) || lowStockAt < 0) return { ok: false, message: 'The alert level must be a whole number, 0 or more.' };

  const products = await readCollection<Product[]>('products');
  const product = products.find((p) => p.id === productId);
  const tier = product?.tiers.find((t) => t.id === tierId);
  if (!product || !tier) return { ok: false, message: 'That pack is no longer in the catalogue.' };

  tier.stock = stock;
  tier.lowStockAt = lowStockAt;
  product.updatedAt = new Date().toISOString();
  await writeCollection('products', products);
  revalidatePath('/inventory');
  revalidatePath('/products');
  return { ok: true, message: `${product.name} — ${tier.name}: ${stock} in stock.` };
}
