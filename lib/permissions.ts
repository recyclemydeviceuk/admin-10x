// =========================================================
// Permission catalog — one id per action, grouped by module.
// Roles hold a list of ids; special forms:
//   '*'          — everything (Super Admin)
//   '<module>.*' — every permission in that module
// Legacy coarse ids (orders.manage, integrations.manage, …)
// still resolve via LEGACY_MAP so old role data keeps working.
// =========================================================

export type PermissionDef = { id: string; label: string; hint?: string };
export type PermissionGroup = { key: string; name: string; permissions: PermissionDef[] };

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: 'dashboard',
    name: 'Dashboard',
    permissions: [{ id: 'dashboard.view', label: 'Open the dashboard' }],
  },
  {
    key: 'analytics',
    name: 'Analytics',
    permissions: [
      { id: 'analytics.view', label: 'Open analytics', hint: 'All tabs and ranges' },
      { id: 'analytics.export', label: 'Download sales reports', hint: 'CSV export' },
    ],
  },
  {
    key: 'orders',
    name: 'Orders',
    permissions: [
      { id: 'orders.view', label: 'View orders' },
      { id: 'orders.create', label: 'Create manual orders' },
      { id: 'orders.status', label: 'Update order status' },
      { id: 'orders.notes', label: 'Add internal notes' },
      { id: 'orders.refund', label: 'Issue refunds', hint: 'Cashfree refund API' },
      { id: 'orders.invoice', label: 'View & download invoices' },
      { id: 'orders.export', label: 'Export orders CSV' },
      { id: 'orders.delete', label: 'Delete orders', hint: 'Permanent — use rarely' },
    ],
  },
  {
    key: 'fulfilment',
    name: 'Fulfilment (Shiprocket)',
    permissions: [
      { id: 'fulfilment.create', label: 'Book shipments' },
      { id: 'fulfilment.awb', label: 'Assign AWB / courier' },
      { id: 'fulfilment.pickup', label: 'Request pickups' },
      { id: 'fulfilment.label', label: 'Generate labels' },
      { id: 'fulfilment.invoice', label: 'Generate Shiprocket invoices' },
      { id: 'fulfilment.track', label: 'Track & sync status' },
      { id: 'fulfilment.cancel', label: 'Cancel shipments' },
      { id: 'fulfilment.manual', label: 'Enter manual tracking', hint: 'Courier + AWB by hand' },
    ],
  },
  {
    key: 'transactions',
    name: 'Transactions',
    permissions: [
      { id: 'transactions.view', label: 'View transactions' },
      { id: 'transactions.sync', label: 'Sync payment status', hint: 'Pull live status from Cashfree' },
      { id: 'transactions.export', label: 'Export transactions CSV' },
    ],
  },
  {
    key: 'returns',
    name: 'Returns & refunds',
    permissions: [
      { id: 'returns.view', label: 'View return requests' },
      { id: 'returns.approve', label: 'Approve returns', hint: 'Books the reverse pickup' },
      { id: 'returns.reject', label: 'Reject returns' },
      { id: 'returns.receive', label: 'Mark parcels received' },
      { id: 'returns.refund', label: 'Refund returns', hint: 'Cashfree or manual payout' },
      { id: 'returns.notes', label: 'Add return notes' },
    ],
  },
  {
    key: 'queries',
    name: 'Customer queries',
    permissions: [
      { id: 'queries.view', label: 'View customer queries' },
      { id: 'queries.reply', label: 'Reply to queries', hint: 'Emails the answer to the customer' },
      { id: 'queries.manage', label: 'Change query status' },
      { id: 'queries.delete', label: 'Delete queries' },
    ],
  },
  {
    key: 'customers',
    name: 'Customers',
    permissions: [
      { id: 'customers.view', label: 'View customers' },
      { id: 'customers.create', label: 'Add customers' },
      { id: 'customers.edit', label: 'Edit customer details' },
      { id: 'customers.export', label: 'Export customers CSV' },
      { id: 'customers.delete', label: 'Delete customers', hint: 'Permanent — use rarely' },
    ],
  },
  {
    key: 'subscriptions',
    name: 'Subscriptions',
    permissions: [
      { id: 'subscriptions.view', label: 'View subscriptions' },
      { id: 'subscriptions.create', label: 'Create subscriptions' },
      { id: 'subscriptions.edit', label: 'Edit plan, quantity & dates' },
      { id: 'subscriptions.pause', label: 'Pause / resume' },
      { id: 'subscriptions.cancel', label: 'Cancel subscriptions' },
      { id: 'subscriptions.export', label: 'Export subscriptions CSV' },
      { id: 'subscriptions.delete', label: 'Delete subscriptions' },
    ],
  },
  {
    key: 'products',
    name: 'Products',
    permissions: [
      { id: 'products.view', label: 'View products' },
      { id: 'products.create', label: 'Add products' },
      { id: 'products.edit', label: 'Edit details & pricing' },
      { id: 'products.media', label: 'Upload product images' },
      { id: 'products.delete', label: 'Delete products' },
    ],
  },
  {
    key: 'inventory',
    name: 'Inventory',
    permissions: [
      { id: 'inventory.view', label: 'Open the inventory page', hint: 'The per-pack stock view' },
      { id: 'inventory.adjust', label: 'Change stock & alert levels' },
    ],
  },
  {
    key: 'coupons',
    name: 'Coupons',
    permissions: [
      { id: 'coupons.view', label: 'View coupons' },
      { id: 'coupons.create', label: 'Create coupons' },
      { id: 'coupons.edit', label: 'Edit coupons' },
      { id: 'coupons.toggle', label: 'Activate / deactivate' },
      { id: 'coupons.export', label: 'Export coupons CSV' },
      { id: 'coupons.delete', label: 'Delete coupons' },
    ],
  },
  {
    key: 'team',
    name: 'Team',
    permissions: [
      { id: 'team.view', label: 'View team members' },
      { id: 'team.invite', label: 'Add team members' },
      { id: 'team.roles', label: 'Change member roles' },
      { id: 'team.password', label: 'Reset passwords' },
      { id: 'team.deactivate', label: 'Deactivate / reactivate' },
      { id: 'team.delete', label: 'Delete accounts' },
    ],
  },
  {
    key: 'roles',
    name: 'Roles & access',
    permissions: [
      { id: 'roles.view', label: 'View roles' },
      { id: 'roles.create', label: 'Create roles' },
      { id: 'roles.edit', label: 'Edit role permissions' },
      { id: 'roles.delete', label: 'Delete roles' },
    ],
  },
  {
    key: 'settings',
    name: 'Settings',
    permissions: [
      { id: 'settings.view', label: 'Open settings' },
      { id: 'settings.backups', label: 'Manage database backups', hint: 'Run, monitor and configure daily backups' },
      { id: 'settings.delivery', label: 'Edit delivery charges', hint: 'Free delivery toggle and the fee' },
      { id: 'settings.maintenance', label: 'Coming-soon mode & signups', hint: 'Take the storefront down to the launch page' },
      { id: 'settings.syncing', label: 'Run store syncing' },
    ],
  },
];

export const ALL_PERMISSION_IDS = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id),
);

const MODULE_IDS = new Map<string, string[]>(
  PERMISSION_GROUPS.map((g) => [g.key, g.permissions.map((p) => p.id)]),
);

/** Coarse ids from the previous catalog → their granular equivalents. */
const LEGACY_MAP: Record<string, string[]> = {
  'orders.manage': [
    'orders.create', 'orders.status', 'orders.notes', 'orders.refund',
    'orders.invoice', 'orders.delete', 'transactions.view', 'transactions.sync',
  ],
  'orders.fulfil': MODULE_IDS.get('fulfilment')!,
  'products.manage': ['products.create', 'products.edit', 'products.media', 'products.delete'],
  'coupons.manage': ['coupons.create', 'coupons.edit', 'coupons.toggle', 'coupons.export', 'coupons.delete'],
  'customers.manage': ['customers.create', 'customers.edit', 'customers.delete'],
  'subscriptions.manage': ['subscriptions.create', 'subscriptions.edit', 'subscriptions.pause', 'subscriptions.cancel', 'subscriptions.delete'],
  'returns.manage': ['returns.approve', 'returns.reject', 'returns.receive', 'returns.refund', 'returns.notes'],
  'team.manage': ['team.invite', 'team.roles', 'team.password', 'team.deactivate', 'team.delete'],
  'roles.manage': MODULE_IDS.get('roles')!,
  'settings.manage': ['settings.view'],
  'integrations.manage': ['settings.syncing'],
};

/** Expand a role's stored permission list into the set of concrete ids it grants. */
export function expandPermissions(stored: string[]): Set<string> {
  const out = new Set<string>();
  for (const p of stored) {
    if (p === '*') return new Set(['*', ...ALL_PERMISSION_IDS]);
    if (p.endsWith('.*')) {
      for (const id of MODULE_IDS.get(p.slice(0, -2)) ?? []) out.add(id);
    } else if (LEGACY_MAP[p]) {
      for (const id of LEGACY_MAP[p]) out.add(id);
    } else {
      out.add(p);
    }
  }
  return out;
}

export function roleHas(permissions: string[], id: string) {
  if (permissions.includes('*')) return true;
  return expandPermissions(permissions).has(id);
}
