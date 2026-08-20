'use client';

import { useState, useTransition } from 'react';

import { setTierStock } from '@/lib/actions/products';

/**
 * Inline stock editor for one pack. The numbers submit together — stock and
 * alert level are one decision — and the row confirms or complains in place.
 */
export function StockRow({
  productId,
  tierId,
  stock,
  lowStockAt,
  canEdit,
}: {
  productId: string;
  tierId: string;
  stock: number;
  lowStockAt: number;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (!canEdit) {
    return <span className="tabular-nums font-semibold">{stock}</span>;
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await setTierStock(productId, tierId, formData);
          setNote({ ok: result.ok, text: result.ok ? 'Saved' : result.message ?? 'Failed' });
          setTimeout(() => setNote(null), 2500);
        })
      }
      className="flex items-center gap-2"
    >
      <input
        name="stock"
        type="number"
        min={0}
        step={1}
        defaultValue={stock}
        aria-label="Stock"
        className="w-20 rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-right text-[13px] tabular-nums outline-none transition-colors hover:border-fg-subtle focus:border-accent-pressed focus:ring-2 focus:ring-accent/25"
      />
      <input
        name="lowStockAt"
        type="number"
        min={0}
        step={1}
        defaultValue={lowStockAt}
        aria-label="Alert when at or below"
        title="Alert when at or below"
        className="w-16 rounded-lg border border-paper-300 bg-white px-2.5 py-1.5 text-right text-[13px] tabular-nums text-fg-muted outline-none transition-colors hover:border-fg-subtle focus:border-accent-pressed focus:ring-2 focus:ring-accent/25"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-paper-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-fg transition-colors hover:border-accent-pressed disabled:opacity-50"
      >
        {pending ? '…' : 'Save'}
      </button>
      {note ? (
        <span className={`text-[11px] font-semibold ${note.ok ? 'text-accent-pressed' : 'text-danger'}`}>
          {note.text}
        </span>
      ) : null}
    </form>
  );
}
