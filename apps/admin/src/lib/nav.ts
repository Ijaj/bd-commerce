export interface NavItem {
  label: string;
  to:
    | '/'
    | '/catalog/products'
    | '/catalog/categories'
    | '/catalog/brands'
    | '/catalog/inventory'
    | '/catalog/import-export'
    | '/content/carousel'
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
    heading: 'Content',
    items: [{ label: 'Home carousel', to: '/content/carousel', anyOf: ['content.manage'] }],
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
    items: [{ label: 'Settings', to: '/settings', anyOf: ['settings.view'] }],
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
