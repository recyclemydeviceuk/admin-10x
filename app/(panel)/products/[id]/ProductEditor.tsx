'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveProduct, deleteProduct } from '@/lib/actions/products';
import { DEFAULT_STOREFRONT, type Product, type ProductTier } from '@/lib/types';
import { IMAGE_SPEC, VIDEO_SPEC, fmtBytes } from '@/lib/media-specs';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/Select';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';

type TierRow = ProductTier & { rowId: string };

/* ---------------------------------------------- client-side media checks
   Files that fail these rules never leave the browser — no request is made. */

function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    el.src = url;
  });
}

/** Returns an error message, or null when the file passes every rule. */
async function validateMedia(file: File, kind: 'image' | 'video'): Promise<string | null> {
  if (kind === 'image') {
    if (!(IMAGE_SPEC.types as readonly string[]).includes(file.type)) {
      return `${file.name}: not an accepted format — use ${IMAGE_SPEC.typeLabel}.`;
    }
    if (file.size > IMAGE_SPEC.maxBytes) {
      return `${file.name}: ${fmtBytes(file.size)} is over the ${IMAGE_SPEC.sizeLabel} image limit.`;
    }
    try {
      const { width, height } = await imageDimensions(file);
      if (width < IMAGE_SPEC.minWidth || height < IMAGE_SPEC.minHeight) {
        return `${file.name}: ${width}×${height} px is too small — at least ${IMAGE_SPEC.minWidth}×${IMAGE_SPEC.minHeight} px.`;
      }
    } catch {
      return `${file.name}: could not be read as an image.`;
    }
    return null;
  }
  if (!(VIDEO_SPEC.types as readonly string[]).includes(file.type)) {
    return `${file.name}: not an accepted format — use ${VIDEO_SPEC.typeLabel}.`;
  }
  if (file.size > VIDEO_SPEC.maxBytes) {
    return `${file.name}: ${fmtBytes(file.size)} is over the ${VIDEO_SPEC.sizeLabel} video limit.`;
  }
  try {
    const seconds = await videoDuration(file);
    if (seconds > VIDEO_SPEC.maxSeconds) {
      return `${file.name}: ${Math.round(seconds)}s is over the ${VIDEO_SPEC.maxSeconds}-second limit.`;
    }
  } catch {
    return `${file.name}: could not be read as a video.`;
  }
  return null;
}

/**
 * One grid of product photos.
 *
 * Rendered twice — once for the light look, once for the dark one — so the two
 * sets behave identically: same cover badge, same reordering, same spec. The
 * hidden inputs are what the form actually submits.
 */
function ImageSet({
  label,
  hint,
  fieldName,
  urls,
  target,
  uploading,
  canManage,
  canMedia,
  onRemove,
  onMove,
  onPick,
}: {
  label: string;
  hint: string;
  fieldName: string;
  urls: string[];
  target: 'light' | 'dark';
  uploading: boolean;
  canManage: boolean;
  canMedia: boolean;
  onRemove: (url: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onPick: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h3 className="text-body font-semibold">{label}</h3>
        <p className="text-caption text-fg-subtle">{hint}</p>
      </div>

      {urls.map((url) => (
        <input key={url} type="hidden" name={fieldName} value={url} />
      ))}

      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <figure
            key={url}
            className={`group relative ${target === 'dark' ? 'rounded-lg bg-ink/90 p-1' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-28 w-28 rounded-lg border border-paper-200 object-cover" />
            {i === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                Cover
              </span>
            ) : null}
            {canManage ? (
              <>
                <button
                  type="button"
                  aria-label={`Remove ${label.toLowerCase()} image`}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-paper-200 bg-white text-fg-muted opacity-0 shadow-card transition-opacity hover:text-danger group-hover:opacity-100"
                  onClick={() => onRemove(url)}
                >
                  <Icon name="x" className="h-3.5 w-3.5" />
                </button>
                <span className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label="Move image left"
                    disabled={i === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-paper-200 bg-white text-fg-muted shadow-card hover:text-fg disabled:invisible"
                    onClick={() => onMove(i, -1)}
                  >
                    <Icon name="chevronLeft" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move image right"
                    disabled={i === urls.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-paper-200 bg-white text-fg-muted shadow-card hover:text-fg disabled:invisible"
                    onClick={() => onMove(i, 1)}
                  >
                    <Icon name="chevronRight" className="h-3.5 w-3.5" />
                  </button>
                </span>
              </>
            ) : null}
          </figure>
        ))}
        {canMedia ? (
          <button
            type="button"
            disabled={uploading}
            onClick={onPick}
            className="flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-paper-300 text-fg-subtle transition-colors hover:border-accent-pressed hover:text-accent-pressed"
          >
            <Icon name="upload" className="h-5 w-5" />
            <span className="text-caption font-medium">{uploading ? 'Uploading…' : 'Upload'}</span>
            <span className="text-[10px] text-fg-subtle">min 800×800</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ProductEditor({ product, canManage, canDelete, canMedia }: { product: Product; canManage: boolean; canDelete: boolean; canMedia: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [status, setStatus] = useState<Product['status']>(product.status);
  const [images, setImages] = useState<string[]>(product.images);
  const [imagesDark, setImagesDark] = useState<string[]>(product.imagesDark ?? []);
  const [video, setVideo] = useState(product.video ?? '');
  const [tiers, setTiers] = useState<TierRow[]>(product.tiers.map((t) => ({ ...t, rowId: t.id })));
  const sf = product.storefront ?? DEFAULT_STOREFRONT;
  const [benefits, setBenefits] = useState<string[]>(sf.benefits.length ? sf.benefits : ['']);
  const imageRef = useRef<HTMLInputElement>(null);
  const imageDarkRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<'image' | 'imageDark' | 'video' | null>(null);

  /**
   * `target` says which photo set an image joins: the light one the storefront
   * shows by default, or the dark one it swaps in for the dark and black
   * looks. Videos ignore it.
   */
  async function upload(
    files: FileList | null,
    kind: 'image' | 'video',
    target: 'light' | 'dark' = 'light',
  ) {
    if (!files?.length) return;
    setUploading(kind === 'image' && target === 'dark' ? 'imageDark' : kind);
    for (const file of Array.from(files)) {
      // Checked in the browser first — a failing file is never uploaded.
      const problem = await validateMedia(file, kind);
      if (problem) {
        toast({ ok: false, message: problem });
        continue;
      }
      const body = new FormData();
      body.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body });
        const data = await res.json();
        if (!data.ok) {
          toast({ ok: false, message: data.message });
          continue;
        }
        if (kind === 'image') {
          const add = target === 'dark' ? setImagesDark : setImages;
          add((cur) => [...cur, data.asset.url]);
        } else setVideo(data.asset.url);
      } catch {
        toast({ ok: false, message: `${file.name}: upload failed.` });
      }
    }
    setUploading(null);
  }

  const moveImage = (index: number, dir: -1 | 1, target: 'light' | 'dark' = 'light') =>
    (target === 'dark' ? setImagesDark : setImages)((cur) => {
      const j = index + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const addTier = () =>
    setTiers((cur) => [
      ...cur,
      {
        rowId: `new-${Date.now().toString(36)}`,
        id: '',
        name: '',
        packets: 30,
        oneTimePrice: 0,
        subscribePrice: 0,
        stock: 0,
        lowStockAt: 10,
        available: false,
      },
    ]);

  const disabled = !canManage || pending;

  return (
    <>
      <form
        action={(formData) =>
          start(async () => {
            toast(await saveProduct(product.id, formData));
          })
        }
        className="space-y-6"
      >
        {/* Basics */}
        <section className="card grid gap-4 md:grid-cols-2">
          <h2 className="text-title md:col-span-2">Basics</h2>
          <div>
            <label className="field-label" htmlFor="name">Name</label>
            <input id="name" name="name" defaultValue={product.name} disabled={disabled} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="status">Status</label>
            <Select
              id="status"
              name="status"
              options={[
                { value: 'active', label: 'Active', hint: 'On sale, visible on the site' },
                { value: 'draft', label: 'Draft', hint: 'Hidden from the storefront' },
                { value: 'archived', label: 'Archived', hint: 'Retired — kept for records' },
              ]}
              value={status}
              onChange={(v) => setStatus(v as Product['status'])}
              disabled={disabled}
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="tagline">Tagline</label>
            <input id="tagline" name="tagline" defaultValue={product.tagline} disabled={disabled} className="field-input" />
          </div>
          <div className="md:col-span-2">
            <label className="field-label" htmlFor="description">Description</label>
            <textarea id="description" name="description" defaultValue={product.description} disabled={disabled} className="field-input min-h-24" />
          </div>
        </section>

        {/* Packs & stock */}
        <section className="card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-title">Packs, pricing & stock</h2>
              <p className="mt-0.5 text-caption text-fg-subtle">
                Prices in rupees. A pack that is off sale disappears from the storefront selectors.
              </p>
            </div>
            {canManage ? (
              <button type="button" className="btn-outline" onClick={addTier}>
                <Icon name="plus" className="h-4 w-4" />
                Add pack
              </button>
            ) : null}
          </div>

          <input type="hidden" name="tierIds" value={tiers.map((t) => t.rowId).join(',')} />

          <div className="scroll-x">
            <table className="w-full min-w-[680px] text-left text-body-sm">
              <thead>
                <tr className="border-b border-paper-200">
                  {['Pack name', 'Packets', 'One-time ₹', 'Subscribe ₹', 'Stock', 'Alert at', 'On sale', ''].map((h, i) => (
                    <th key={`${h}-${i}`} className="px-2 py-2.5 text-overline uppercase text-fg-subtle">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-200">
                {tiers.map((tier) => (
                  <tr key={tier.rowId}>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.name`} defaultValue={tier.name} placeholder="30 Pack" disabled={disabled} className="field-input min-w-28" />
                    </td>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.packets`} type="number" min={1} defaultValue={tier.packets} disabled={disabled} className="field-input max-w-20" />
                    </td>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.oneTimePrice`} type="number" min={1} defaultValue={tier.oneTimePrice || ''} disabled={disabled} className="field-input max-w-24" />
                    </td>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.subscribePrice`} type="number" min={1} defaultValue={tier.subscribePrice || ''} disabled={disabled} className="field-input max-w-24" />
                    </td>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.stock`} type="number" min={0} defaultValue={tier.stock} disabled={disabled} className="field-input max-w-20" />
                      <input type="hidden" name={`tier.${tier.rowId}.stockWas`} value={tier.stock} />
                    </td>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.lowStockAt`} type="number" min={0} defaultValue={tier.lowStockAt} disabled={disabled} className="field-input max-w-20" />
                    </td>
                    <td className="px-2 py-3">
                      <input name={`tier.${tier.rowId}.available`} type="checkbox" defaultChecked={tier.available} disabled={disabled} className="h-4 w-4 accent-[#4EA310]" />
                    </td>
                    <td className="px-2 py-3">
                      {canManage && tiers.length > 1 ? (
                        <button
                          type="button"
                          className="p-1 text-fg-subtle transition-colors hover:text-danger"
                          title="Remove pack"
                          onClick={() => setTiers((cur) => cur.filter((t) => t.rowId !== tier.rowId))}
                        >
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Media — upload only */}
        <section className="card space-y-5">
          <div>
            <h2 className="text-title">Images</h2>
            <p className="mt-0.5 text-caption text-fg-subtle">
              Two sets: one for the light look, one the storefront swaps in for dark and black.
              First image in each is the cover. Use the arrows to reorder.
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1 text-caption font-medium text-fg-muted">
              <Icon name="image" className="h-3.5 w-3.5" />
              {IMAGE_SPEC.text}
            </p>
          </div>

          <ImageSet
            label="Light mode"
            hint="Shown on the white storefront."
            fieldName="images[]"
            urls={images}
            target="light"
            uploading={uploading === 'image'}
            canManage={canManage}
            canMedia={canMedia}
            onRemove={(url) => setImages((cur) => cur.filter((u) => u !== url))}
            onMove={(i, dir) => moveImage(i, dir, 'light')}
            onPick={() => imageRef.current?.click()}
          />

          <div className="border-t border-paper-200 pt-5">
            <ImageSet
              label="Dark mode"
              hint="Used for the dark and black looks. Leave empty to reuse the light photos."
              fieldName="imagesDark[]"
              urls={imagesDark}
              target="dark"
              uploading={uploading === 'imageDark'}
              canManage={canManage}
              canMedia={canMedia}
              onRemove={(url) => setImagesDark((cur) => cur.filter((u) => u !== url))}
              onMove={(i, dir) => moveImage(i, dir, 'dark')}
              onPick={() => imageDarkRef.current?.click()}
            />
          </div>

          <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files, 'image', 'light')} />
          <input ref={imageDarkRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files, 'image', 'dark')} />

          <div className="border-t border-paper-200 pt-5">
            <h3 className="text-body font-semibold">Product video (optional)</h3>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-paper-100 px-3 py-1 text-caption font-medium text-fg-muted">
              <Icon name="video" className="h-3.5 w-3.5" />
              {VIDEO_SPEC.text}
            </p>
            <input type="hidden" name="video" value={video} />
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {video ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={video} controls preload="metadata" className="h-40 max-w-72 rounded-lg border border-paper-200 bg-ink" />
                  <span className="flex items-center gap-2 text-caption text-fg-muted">
                    {video.split('/').pop()}
                    {canManage ? (
                      <button type="button" aria-label="Remove video" className="text-fg-subtle hover:text-danger" onClick={() => setVideo('')}>
                        <Icon name="x" className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                </div>
              ) : (
                <span className="text-body-sm text-fg-subtle">No video yet.</span>
              )}
              {canMedia ? (
                <button type="button" className="btn-outline" disabled={uploading === 'video'} onClick={() => videoRef.current?.click()}>
                  <Icon name="upload" className="h-4 w-4" />
                  {uploading === 'video' ? 'Uploading…' : video ? 'Replace video' : 'Upload video'}
                </button>
              ) : null}
            </div>
            <input ref={videoRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => upload(e.target.files, 'video')} />
          </div>
        </section>

        {/* Storefront product page — the hero the customer sees */}
        <section className="card space-y-5">
          <div>
            <h2 className="text-title">Storefront page</h2>
            <p className="mt-0.5 text-caption text-fg-subtle">
              Everything in the product-page hero — the lead-in, notes, button label and bullet
              pointers. The site picks changes up within seconds.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="sfKicker">Lead-in above the pack name</label>
              <input id="sfKicker" name="sfKicker" defaultValue={sf.kicker} disabled={disabled} placeholder="10X Day Time —" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="sfCtaLabel">Add-to-cart button label</label>
              <input id="sfCtaLabel" name="sfCtaLabel" defaultValue={sf.ctaLabel} disabled={disabled} placeholder="Add to Cart" className="field-input" />
            </div>
            <div className="md:col-span-2">
              <label className="field-label" htmlFor="sfSubscriptionNote">Note under the plan selector</label>
              <input id="sfSubscriptionNote" name="sfSubscriptionNote" defaultValue={sf.subscriptionNote} disabled={disabled} placeholder="Skip or cancel anytime, no login required." className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="sfPriceNote">Note under the one-time price</label>
              <input id="sfPriceNote" name="sfPriceNote" defaultValue={sf.priceNote} disabled={disabled} placeholder="One-time purchase · incl. GST" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="sfSubscribePriceNote">Note under the subscription price</label>
              <input id="sfSubscribePriceNote" name="sfSubscribePriceNote" defaultValue={sf.subscribePriceNote} disabled={disabled} placeholder="Every 4 weeks · skip or cancel anytime · incl. GST" className="field-input" />
            </div>
            <div className="md:col-span-2">
              <label className="field-label" htmlFor="sfPerfectFor">"Perfect for" line</label>
              <input id="sfPerfectFor" name="sfPerfectFor" defaultValue={sf.perfectFor} disabled={disabled} placeholder="Creators, developers, athletes, and directors." className="field-input" />
            </div>
          </div>

          <div className="border-t border-paper-200 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-body font-semibold">Benefit pointers</h3>
                <p className="mt-0.5 text-caption text-fg-subtle">The bullet list under the description — add as many as you need.</p>
              </div>
              {canManage ? (
                <button type="button" className="btn-outline" onClick={() => setBenefits((cur) => [...cur, ''])}>
                  <Icon name="plus" className="h-4 w-4" />
                  Add pointer
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent-pressed" />
                  <input
                    name="benefits[]"
                    value={b}
                    disabled={disabled}
                    placeholder="e.g. Sustained focus support"
                    className="field-input"
                    onChange={(e) =>
                      setBenefits((cur) => cur.map((x, xi) => (xi === i ? e.target.value : x)))
                    }
                  />
                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="Move pointer up"
                        disabled={i === 0}
                        className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-paper-100 hover:text-fg disabled:invisible"
                        onClick={() =>
                          setBenefits((cur) => {
                            const next = [...cur];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next;
                          })
                        }
                      >
                        <Icon name="chevronLeft" className="h-4 w-4 rotate-90" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move pointer down"
                        disabled={i === benefits.length - 1}
                        className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-paper-100 hover:text-fg disabled:invisible"
                        onClick={() =>
                          setBenefits((cur) => {
                            const next = [...cur];
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            return next;
                          })
                        }
                      >
                        <Icon name="chevronRight" className="h-4 w-4 rotate-90" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove pointer"
                        className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                        onClick={() => setBenefits((cur) => cur.filter((_, xi) => xi !== i))}
                      >
                        <Icon name="x" className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {benefits.length === 0 ? (
                <p className="text-body-sm text-fg-subtle">No pointers yet — add the first one.</p>
              ) : null}
            </div>
          </div>
        </section>

        {/* SEO */}
        <section className="card grid gap-4">
          <h2 className="text-title">SEO</h2>
          <div>
            <label className="field-label" htmlFor="seoTitle">Meta title</label>
            <input id="seoTitle" name="seoTitle" defaultValue={product.seo.title} disabled={disabled} className="field-input" />
          </div>
          <div>
            <label className="field-label" htmlFor="seoDescription">Meta description</label>
            <textarea id="seoDescription" name="seoDescription" defaultValue={product.seo.description} disabled={disabled} className="field-input min-h-20" />
          </div>
        </section>

        {canManage ? (
          <button type="submit" disabled={pending} className="btn-accent px-8 py-3">
            {pending ? 'Saving…' : 'Save product'}
          </button>
        ) : (
          <p className="text-body-sm text-fg-subtle">Your role can view this product but not edit it.</p>
        )}
      </form>

      {canDelete ? (
        <div className="mt-8 border-t border-paper-200 pt-5">
          <button
            type="button"
            className="text-body-sm font-medium text-danger/70 transition-colors hover:text-danger"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${product.name}?`,
                message: 'This removes the product permanently. Archiving (Status → Archived) is usually the better move.',
                confirmLabel: 'Delete product',
              });
              if (!ok) return;
              start(async () => {
                const res = await deleteProduct(product.id);
                if (res.ok) router.push('/products');
                toast(res);
              });
            }}
          >
            Delete this product permanently
          </button>
        </div>
      ) : null}
    </>
  );
}
