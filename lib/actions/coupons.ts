'use server';

import { revalidatePath } from 'next/cache';
import { readCollection, writeCollection, newId } from '@/lib/db';
import { assertPermission } from '@/lib/auth';
import type { Coupon } from '@/lib/types';
import type { ActionResult } from './orders';

function parseCouponForm(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const type = formData.get('type') === 'flat' ? 'flat' : ('percent' as const);
  const value = Number(formData.get('value'));
  const minOrder = Number(formData.get('minOrder') ?? 0);
  const maxDiscount = Number(formData.get('maxDiscount') ?? 0);
  const usageLimit = Number(formData.get('usageLimit') ?? 0);
  const perCustomerLimit = Number(formData.get('perCustomerLimit') ?? 0);
  const expiresAt = String(formData.get('expiresAt') ?? '');

  if (!code) return { error: 'Give the coupon a code.' };
  if (!Number.isFinite(value) || value <= 0) return { error: 'The discount value must be a positive number.' };
  if (type === 'percent' && value > 90) return { error: 'A percent discount can’t exceed 90.' };

  return {
    coupon: {
      code,
      description: String(formData.get('description') ?? '').trim(),
      type,
      value,
      minOrder: Number.isFinite(minOrder) ? minOrder : 0,
      ...(type === 'percent' && maxDiscount > 0 ? { maxDiscount } : {}),
      usageLimit: usageLimit > 0 ? usageLimit : null,
      perCustomerLimit: perCustomerLimit > 0 ? perCustomerLimit : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      active: formData.get('active') === 'on',
    },
  };
}

export async function saveCoupon(couponId: string | null, formData: FormData): Promise<ActionResult> {
  const user = await assertPermission(couponId ? 'coupons.edit' : 'coupons.create');
  const parsed = parseCouponForm(formData);
  if ('error' in parsed) return { ok: false, message: parsed.error! };

  const coupons = await readCollection<Coupon[]>('coupons');
  const clash = coupons.find((c) => c.code === parsed.coupon.code && c.id !== couponId);
  if (clash) return { ok: false, message: `The code ${parsed.coupon.code} already exists.` };

  if (couponId) {
    const existing = coupons.find((c) => c.id === couponId);
    if (!existing) return { ok: false, message: 'Coupon not found.' };
    delete existing.maxDiscount; // re-set below only when the parsed form carries it
    Object.assign(existing, parsed.coupon);
  } else {
    coupons.unshift({
      id: newId('coup'),
      ...parsed.coupon,
      usedCount: 0,
      startsAt: new Date().toISOString(),
      createdBy: user.name,
    } as Coupon);
  }

  await writeCollection('coupons', coupons);
  revalidatePath('/coupons');
  return { ok: true, message: couponId ? 'Coupon updated.' : `Coupon ${parsed.coupon.code} created.` };
}

export async function toggleCoupon(couponId: string): Promise<ActionResult> {
  await assertPermission('coupons.toggle');
  const coupons = await readCollection<Coupon[]>('coupons');
  const coupon = coupons.find((c) => c.id === couponId);
  if (!coupon) return { ok: false, message: 'Coupon not found.' };
  coupon.active = !coupon.active;
  await writeCollection('coupons', coupons);
  revalidatePath('/coupons');
  return { ok: true, message: `${coupon.code} is now ${coupon.active ? 'active' : 'inactive'}.` };
}

export async function deleteCoupon(couponId: string): Promise<ActionResult> {
  await assertPermission('coupons.delete');
  const coupons = await readCollection<Coupon[]>('coupons');
  const idx = coupons.findIndex((c) => c.id === couponId);
  if (idx === -1) return { ok: false, message: 'Coupon not found.' };
  const [removed] = coupons.splice(idx, 1);
  await writeCollection('coupons', coupons);
  revalidatePath('/coupons');
  return { ok: true, message: `${removed.code} deleted.` };
}
