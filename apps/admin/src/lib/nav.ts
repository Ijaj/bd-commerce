export interface NavItem {
  label: string;
  to:
    | '/'
    | '/catalog/products'
    | '/catalog/categories'
    | '/catalog/brands'
    | '/catalog/inventory'
    | '/catalog/import-export'
    | '/orders'
    | '/call-queue'
    | '/shipments'
    | '/returns'
    | '/refunds'
    | '/promotions/coupons'
    | '/promotions/flash-sales'
    | '/promotions/bulk-sales'
    | '/content/carousel'
    | '/b2b/sales'
    | '/b2b/shops'
    | '/b2b/collections'
    | '/b2b/dues'
    | '/sr/team'
    | '/delivery'
    | '/staff'
    | '/roles'
    | '/settings';
  /** Shown when the staff holds ANY of these (empty = always). */
  anyOf?: string[];
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

/** Sidebar structure (matches plan/mockups/admin). Later steps add Orders, Customers, Marketing... */
export const NAV: NavSection[] = [
  { items: [{ label: 'Dashboard', to: '/' }] },
  {
    heading: 'Catalog',
    items: [
      { label: 'Products', to: '/catalog/products', anyOf: ['products.view'] },
      { label: 'Categories', to: '/catalog/categories', anyOf: ['categories.view'] },
      { label: 'Brands', to: '/catalog/brands', anyOf: ['products.view'] },
      { label: 'Inventory', to: '/catalog/inventory', anyOf: ['inventory.view'] },
      {
        label: 'Import / Export',
        to: '/catalog/import-export',
        anyOf: ['products.import', 'products.export', 'inventory.export'],
      },
    ],
  },
  {
    heading: 'Orders',
    items: [
      { label: 'Orders', to: '/orders', anyOf: ['orders.view'] },
      { label: 'Call queue', to: '/call-queue', anyOf: ['orders.call'] },
      { label: 'Shipments', to: '/shipments', anyOf: ['shipments.manage'] },
      { label: 'Returns', to: '/returns', anyOf: ['returns.manage'] },
      { label: 'Refunds', to: '/refunds', anyOf: ['refunds.manage', 'refunds.approve'] },
    ],
  },
  {
    heading: 'Promotions',
    items: [
      { label: 'Coupons', to: '/promotions/coupons', anyOf: ['coupons.view', 'coupons.manage'] },
      { label: 'Flash sales', to: '/promotions/flash-sales', anyOf: ['flash_sales.manage'] },
      { label: 'Bulk sales', to: '/promotions/bulk-sales', anyOf: ['bulk_sales.manage'] },
    ],
  },
  {
    heading: 'Content',
    items: [{ label: 'Home carousel', to: '/content/carousel', anyOf: ['content.manage'] }],
  },
  {
    heading: 'B2B / SR',
    items: [
      { label: 'SR sales', to: '/b2b/sales', anyOf: ['b2b.view'] },
      { label: 'Buyer shops', to: '/b2b/shops', anyOf: ['b2b.view'] },
      { label: 'Collections', to: '/b2b/collections', anyOf: ['b2b.view', 'sr.approve'] },
      { label: 'Dues ageing', to: '/b2b/dues', anyOf: ['b2b.view'] },
      { label: 'SR team', to: '/sr/team', anyOf: ['sr.manage'] },
    ],
  },
  {
    heading: 'Staff',
    items: [
      { label: 'Staff', to: '/staff', anyOf: ['staff.view'] },
      { label: 'Roles', to: '/roles', anyOf: ['staff.view', 'roles.manage'] },
    ],
  },
  {
    heading: 'Settings',
    items: [
      { label: 'Settings', to: '/settings', anyOf: ['settings.view'] },
      { label: 'Delivery zones', to: '/delivery', anyOf: ['delivery.manage'] },
    ],
  },
];

/** Drops items the staff cannot use, and sections left empty. */
export function visibleNav(permissions: readonly string[]): NavSection[] {
  return NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => !i.anyOf || i.anyOf.some((p) => permissions.includes(p))),
  })).filter((s) => s.items.length > 0);
}

export function isActive(itemTo: string, pathname: string): boolean {
  return itemTo === '/'
    ? pathname === '/'
    : pathname === itemTo || pathname.startsWith(`${itemTo}/`);
}
