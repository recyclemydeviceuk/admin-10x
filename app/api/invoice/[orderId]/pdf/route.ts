import { getSessionUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { backendFetch } from '@/lib/backend';
import { renderInvoicePdf } from '@/lib/invoice-pdf';
import type { Order, Settings } from '@/lib/types';

// Direct PDF download — Content-Disposition: attachment means the browser
// saves the file instead of opening a page.
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getSessionUser();
  if (!user || !can(user, 'orders.invoice')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { orderId } = await params;
  let orders = await readCollection<Order[]>('orders');
  let order = orders.find((o) => o.id === orderId);
  if (!order) return new Response('Order not found', { status: 404 });

  if (!order.invoiceNo) {
    // The invoice number comes from the API's counter — asking the server to
    // render the invoice once mints it, then a re-read picks it up. Counting
    // rows here would fork the sequence.
    await backendFetch(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/invoice?print=0`);
    orders = await readCollection<Order[]>('orders');
    order = orders.find((o) => o.id === orderId) ?? order;
  }

  const settings = await readCollection<Settings>('settings');
  const pdf = await renderInvoicePdf(order, settings);

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${order.invoiceNo || order.reference}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
