export type NavItem = {
  href: string;
  label: string;
  icon: string; // key into components/Icon.tsx
  /** '' means every signed-in admin — used for pages that hold per-account things. */
  permission: string;
};

export type NavGroup = { name: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    name: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view' },
      { href: '/analytics', label: 'Analytics', icon: 'chart', permission: 'analytics.view' },
    ],
  },
  {
    name: 'Store',
    items: [
      { href: '/orders', label: 'Orders', icon: 'orders', permission: 'orders.view' },
      { href: '/transactions', label: 'Transactions', icon: 'card', permission: 'transactions.view' },
      { href: '/returns', label: 'Returns', icon: 'return', permission: 'returns.view' },
      { href: '/queries', label: 'Queries', icon: 'chat', permission: 'queries.view' },
      { href: '/subscriptions', label: 'Subscriptions', icon: 'repeat', permission: 'subscriptions.view' },
      { href: '/customers', label: 'Customers', icon: 'users', permission: 'customers.view' },
      { href: '/products', label: 'Products', icon: 'box', permission: 'products.view' },
      { href: '/inventory', label: 'Inventory', icon: 'database', permission: 'inventory.view' },
      { href: '/coupons', label: 'Coupons', icon: 'tag', permission: 'coupons.view' },
    ],
  },
  {
    name: 'Admin',
    items: [
      { href: '/team', label: 'Team', icon: 'team', permission: 'team.view' },
      { href: '/roles', label: 'Roles & Access', icon: 'shield', permission: 'roles.view' },
      // Super Admin only: the nav filter treats '*' as "must hold the wildcard".
      { href: '/audit', label: 'Audit log', icon: 'eye', permission: '*' },
      { href: '/settings', label: 'Settings', icon: 'settings', permission: '' },
    ],
  },
];
