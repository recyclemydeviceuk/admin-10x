import 'server-only';
import type { Order } from './types';

// Shared bits between the HTML invoice (view/print) and the PDF download.

export const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function paymentLineFor(order: Order): string {
  const paidOnline = order.payment?.provider === 'cashfree';
  if (order.paymentStatus === 'refunded') return 'Refunded in full';
  if (paidOnline)
    return `Paid online${order.payment?.method ? ` via ${order.payment.method.toUpperCase()}` : ''}${order.payment?.cfPaymentId ? ` · Ref ${order.payment.cfPaymentId}` : ''}`;
  return order.paymentStatus === 'paid' ? 'Paid — cash on delivery' : 'Cash on delivery — payable on delivery';
}
