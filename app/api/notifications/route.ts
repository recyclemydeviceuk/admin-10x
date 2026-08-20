import { getSessionUser } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import type { PanelEvent } from '@/lib/events';
import { backendFetch } from '@/lib/backend';

// Polled by the notification bell every few seconds — must stay cheap.
//
// It used to kick the syncing engine on the way past. That engine lives on
// the API now and runs on its own timer there, so the store keeps itself in
// sync whether or not anyone has the panel open — and two engines can't race
// each other to book the same shipment.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ events: [] }, { status: 401 });

  const events = await readCollection<PanelEvent[]>('events');
  return Response.json(
    { events: events.slice(0, 50), readIds: user.readNotificationIds },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { readIds?: string[] };
  const readIds = Array.isArray(body.readIds) ? body.readIds.map(String).slice(-300) : [];
  const response = await backendFetch('/api/v1/admin/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ readNotificationIds: readIds }),
  });
  return Response.json({ ok: response.ok }, { status: response.ok ? 200 : response.status });
}
