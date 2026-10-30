import type { IconName } from '@bdc/ui';

export interface NavItem {
  label: string;
  icon: IconName;
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
    | '/suppliers'
    | '/purchase-orders'
    | '/sr/team'
    | '/delivery'
    | '/staff'
    | '/roles'
    | '/settings';
  /** Shown when the staff holds ANY of these (empty = always). */
  anyOf?: string[];
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

/** Sidebar: groups, order, labels and icons from plan/mockups/admin (admin-core.js NAV), C60. */
export const NAV: NavSection[] = [
  { heading: 'Overview', items: [{ label: 'Dashboard', icon: 'dashboard', to: '/' }] },
  {
    heading: 'Sales',
    items: [
      { label: 'Orders', icon: 'orders', to: '/orders', anyOf: ['orders.view'] },
      { label: 'Call queue', icon: 'phone', to: '/call-queue', anyOf: ['orders.call'] },
      { label: 'Shipments', icon: 'truck', to: '/shipments', anyOf: ['shipments.manage'] },
      { label: 'Returns & refunds', icon: 'returns', to: '/returns', anyOf: ['returns.manage'] },
      {
        label: 'Refunds',
        icon: 'wallet',
        to: '/refunds',
        anyOf: ['refunds.manage', 'refunds.approve'],
      },
    ],
  },
  {
    heading: 'Catalog',
    items: [
      { label: 'Products', icon: 'products', to: '/catalog/products', anyOf: ['products.view'] },
      {
        label: 'Categories & attributes',
        icon: 'categories',
        to: '/catalog/categories',
        anyOf: ['categories.view'],
      },
      { label: 'Brands', icon: 'products', to: '/catalog/brands', anyOf: ['products.view'] },
      {
        label: 'Inventory',
        icon: 'inventory',
        to: '/catalog/inventory',
        anyOf: ['inventory.view'],
      },
      {
        label: 'Import / Export',
        icon: 'upload',
        to: '/catalog/import-export',
        anyOf: ['products.import', 'products.export', 'inventory.export'],
      },
    ],
  },
  {
    heading: 'Marketing',
    items: [
      {
        label: 'Coupons & discounts',
        icon: 'coupons',
        to: '/promotions/coupons',
        anyOf: ['coupons.view', 'coupons.manage'],
      },
      {
        label: 'Flash sales',
        icon: 'flash',
        to: '/promotions/flash-sales',
        anyOf: ['flash_sales.manage'],
      },
      {
        label: 'Bulk sales',
        icon: 'coupons',
        to: '/promotions/bulk-sales',
        anyOf: ['bulk_sales.manage'],
      },
      { label: 'Home & feed', icon: 'home', to: '/content/carousel', anyOf: ['content.manage'] },
    ],
  },
  {
    heading: 'People & partners',
    items: [
      { label: 'Suppliers & POs', icon: 'suppliers', to: '/suppliers', anyOf: ['suppliers.view'] },
      { label: 'Purchase orders', icon: 'po', to: '/purchase-orders', anyOf: ['suppliers.view'] },
      { label: 'SR approvals', icon: 'check', to: '/b2b/sales', anyOf: ['b2b.view'] },
      { label: 'B2B shops', icon: 'suppliers', to: '/b2b/shops', anyOf: ['b2b.view'] },
      {
        label: 'Collections',
        icon: 'wallet',
        to: '/b2b/collections',
        anyOf: ['b2b.view', 'sr.approve'],
      },
      { label: 'SR team', icon: 'staff', to: '/sr/team', anyOf: ['sr.manage'] },
      { label: 'B2B dues', icon: 'wallet', to: '/b2b/dues', anyOf: ['b2b.view'] },
      {
        label: 'Delivery & couriers',
        icon: 'delivery',
        to: '/delivery',
        anyOf: ['delivery.manage'],
      },
    ],
  },
  {
    heading: 'System',
    items: [
      { label: 'Staff', icon: 'staff', to: '/staff', anyOf: ['staff.view'] },
      {
        label: 'Roles & permissions',
        icon: 'roles',
        to: '/roles',
        anyOf: ['staff.view', 'roles.manage'],
      },
      { label: 'Settings', icon: 'settings', to: '/settings', anyOf: ['settings.view'] },
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
