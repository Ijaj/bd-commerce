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
  // Step 3: home page content and customers.
  'content.manage': {
    group: 'Content',
    description: 'Manage home carousel slides and home feed weights',
  },
  'customers.view': { group: 'Customers', description: 'View customer accounts' },
  'customers.manage': { group: 'Customers', description: 'Disable or flag customer accounts' },
  // Step 4: orders + delivery.
  'orders.view': { group: 'Orders', description: 'View orders' },
  'orders.manage': { group: 'Orders', description: 'Change order status, hold, cancel' },
  // Step 5: order operations.
  'orders.call': { group: 'Orders', description: 'Work the call-confirmation queue' },
  'shipments.manage': {
    group: 'Orders',
    description: 'Create shipments, book couriers, print invoices and labels',
  },
  'returns.manage': { group: 'Orders', description: 'Handle return requests and receive returns' },
  'refunds.manage': { group: 'Orders', description: 'Create refunds below the approval threshold' },
  'refunds.approve': { group: 'Orders', description: 'Approve refunds above the threshold' },
  'delivery.manage': {
    group: 'Settings',
    description: 'Manage delivery zones, charges and zone locations',
  },
  // Step 6: promotions.
  'coupons.view': { group: 'Promotions', description: 'View coupons and their reports' },
  'coupons.manage': {
    group: 'Promotions',
    description: 'Create, edit, pause coupons and bulk codes',
  },
  'flash_sales.manage': { group: 'Promotions', description: 'Create and edit flash sales' },
  'bulk_sales.manage': { group: 'Promotions', description: 'Run and undo bulk sale price changes' },
  // Step 7: SR / B2B (R10–R20) and purchasing (Q62).
  'sr.portal': {
    group: 'SR / B2B',
    description: 'Use the SR section of the partner portal (own sales, shops, collections)',
  },
  'sr.approve': {
    group: 'SR / B2B',
    description: 'Approve, reject and mark SR sales delivered; confirm due collections',
  },
  'sr.manage': {
    group: 'SR / B2B',
    description: 'Manage SR profiles, targets and commissions',
  },
  'b2b.view': { group: 'SR / B2B', description: 'View buyer shops, SR sales and due ledgers' },
  'b2b.manage': {
    group: 'SR / B2B',
    description: 'Edit/block buyer shops and post ledger adjustments',
  },
  'suppliers.view': { group: 'Suppliers & POs', description: 'View suppliers and purchase orders' },
  'suppliers.manage': {
    group: 'Suppliers & POs',
    description: 'Manage suppliers, product links and purchase orders',
  },
  'purchase_orders.receive': {
    group: 'Suppliers & POs',
    description: 'Receive goods against purchase orders (adds stock)',
  },
  'supplier_payments.manage': {
    group: 'Suppliers & POs',
    description: 'Record supplier payments and ledger adjustments',
  },
} as const satisfies Record<string, { group: string; description: string }>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const OWNER_ROLE = 'Owner';
