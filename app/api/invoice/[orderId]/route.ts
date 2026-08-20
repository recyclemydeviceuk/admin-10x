import { getSessionUser, can } from '@/lib/auth';
import { backendFetch } from '@/lib/backend';

// The invoice is rendered by the API server — one renderer for the customer's
// account, this print view and the PDF, so they can never drift apart. The
// invoice number is minted there too, from the real counter.
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getSessionUser();
  if (!user || !can(user, 'orders.invoice')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { orderId } = await params;
  const upstream = await backendFetch(`/api/v1/admin/orders/${encodeURIComponent(orderId)}/invoice`);
  if (!upstream.ok) {
    return new Response(upstream.status === 404 ? 'Order not found' : 'Invoice unavailable', {
      status: upstream.status,
    });
  }
  return new Response(await upstream.text(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
