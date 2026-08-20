import { requireUser, can } from '@/lib/auth';
import { readCollection } from '@/lib/db';
import { NAV_GROUPS } from '@/lib/nav';
import type { CustomerQuery, Order, ReturnRequest } from '@/lib/types';
import { AdminShell } from '@/components/shell/AdminShell';
import { logout } from '@/app/login/actions';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Only show what this role can open — the pages enforce again server-side.
  const nav = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.permission === '' || can(user, item.permission)),
  })).filter((g) => g.items.length > 0);

  // Live badge: orders waiting to be fulfilled.
  const badges: Record<string, number> = {};
  if (can(user, 'orders.view')) {
    const orders = await readCollection<Order[]>('orders');
    const toFulfil = orders.filter((o) => ['placed', 'confirmed', 'packed'].includes(o.status)).length;
    if (toFulfil > 0) badges['/orders'] = toFulfil;
  }
  if (can(user, 'queries.view')) {
    const queries = await readCollection<CustomerQuery[]>('queries');
    const unanswered = queries.filter((q) => q.status === 'new').length;
    if (unanswered > 0) badges['/queries'] = unanswered;
  }
  if (can(user, 'returns.view')) {
    const returns = await readCollection<ReturnRequest[]>('returns');
    const pending = returns.filter((r) => r.status === 'requested').length;
    if (pending > 0) badges['/returns'] = pending;
  }

  return (
    <AdminShell
      nav={nav}
      user={{
        name: user.name,
        email: user.email,
        roleName: user.role.name,
        avatarUrl: user.avatarUrl,
        preferences: user.preferences,
      }}
      badges={badges}
      logout={logout}
    >
      {children}
    </AdminShell>
  );
}
