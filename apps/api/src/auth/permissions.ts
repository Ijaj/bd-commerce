/**
 * Permission catalog (doc 12 §2). Code is the source of truth: synced to the
 * `permissions` table at startup. Later steps add their own keys here.
 */
export const PERMISSIONS = {
  'staff.view': { group: 'Staff', description: 'View staff accounts' },
  'staff.manage': {
    group: 'Staff',
    description: 'Create, edit, disable staff; assign roles; reset 2FA',
  },
  'roles.manage': { group: 'Staff', description: 'Create and edit roles' },
  'settings.view': { group: 'Settings', description: 'View store settings and feature flags' },
  'settings.manage': {
    group: 'Settings',
    description: 'Change store settings, feature flags, maintenance mode and announcement bar',
  },
  // Catalog (doc 06 matrix). Brands and media uploads go with products/categories edit rights.
  'products.view': { group: 'Products', description: 'View products, variants and brands' },
  'products.create': { group: 'Products', description: 'Create products and brands' },
  'products.edit': { group: 'Products', description: 'Edit products, variants, images and brands' },
  'products.delete': { group: 'Products', description: 'Delete or archive products and brands' },
  'products.publish': {
    group: 'Products',
    description: 'Publish, unpublish and schedule products',
  },
  'products.edit_price': {
    group: 'Products',
    description: 'Change variant prices and sale prices',
  },
  'products.view_cost': { group: 'Products', description: 'See and edit cost prices' },
  'products.export': { group: 'Products', description: 'Export products to XLSX/CSV' },
  'products.import': { group: 'Products', description: 'Bulk import products from XLSX/CSV' },
  'categories.view': { group: 'Categories', description: 'View categories and attributes' },
  'categories.create': { group: 'Categories', description: 'Create categories' },
  'categories.edit': {
    group: 'Categories',
    description: 'Edit categories, attributes and options',
  },
  'categories.delete': {
    group: 'Categories',
    description: 'Delete categories (moving their products elsewhere)',
  },
  'categories.set_home': { group: 'Categories', description: 'Choose home page categories' },
  'categories.delete_with_products': {
    group: 'Categories',
    description: 'Delete a category together with its sub-categories and products',
  },
  'inventory.view': { group: 'Inventory', description: 'View stock levels and stock history' },
  'inventory.adjust': {
    group: 'Inventory',
    description: 'Adjust stock and low-stock thresholds',
  },
  'inventory.export': { group: 'Inventory', description: 'Export stock levels' },
} as const satisfies Record<string, { group: string; description: string }>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const OWNER_ROLE = 'Owner';
