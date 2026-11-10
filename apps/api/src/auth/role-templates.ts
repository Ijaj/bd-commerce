import { ALL_PERMISSIONS, type PermissionKey } from './permissions';

/**
 * Starter roles (plan/06, B1). Plain editable roles, seeded once on the very first boot
 * (see RbacService); the owner may edit or delete them freely.
 */
const MANAGER_EXCLUDED: PermissionKey[] = [
  'staff.manage',
  'roles.manage',
  'settings.manage',
  'sr.portal',
  'categories.delete_with_products',
];

export const ROLE_TEMPLATES: { name: string; description: string; permissions: PermissionKey[] }[] =
  [
    {
      name: 'Manager',
      description: 'Runs the store day to day: everything except staff, roles and settings',
      permissions: ALL_PERMISSIONS.filter((p) => !MANAGER_EXCLUDED.includes(p)),
    },
    {
      name: 'Catalog Editor',
      description: 'Products, categories and brands, plus stock levels (read only)',
      permissions: [
        'products.view',
        'products.create',
        'products.edit',
        'products.publish',
        'products.edit_price',
        'products.export',
        'products.import',
        'categories.view',
        'categories.create',
        'categories.edit',
        'categories.set_home',
        'inventory.view',
      ],
    },
    {
      name: 'Order Processor / Call Center',
      description: 'Confirms and processes orders, books couriers, handles returns',
      permissions: [
        'orders.view',
        'orders.manage',
        'orders.edit',
        'orders.call',
        'shipments.manage',
        'returns.manage',
        'customers.view',
        'products.view',
        'inventory.view',
      ],
    },
    {
      name: 'Warehouse / Packer',
      description: 'Packs and hands over shipments, receives stock and returns',
      permissions: [
        'orders.view',
        'shipments.manage',
        'returns.manage',
        'inventory.view',
        'inventory.adjust',
        'products.view',
        'suppliers.view',
        'purchase_orders.receive',
      ],
    },
    {
      name: 'Marketing',
      description: 'Coupons, flash and bulk sales, affiliates and site content',
      permissions: [
        'coupons.view',
        'coupons.manage',
        'flash_sales.manage',
        'bulk_sales.manage',
        'affiliates.view',
        'affiliates.manage',
        'content.manage',
        'products.view',
        'categories.view',
        'customers.view',
      ],
    },
    {
      name: 'Customer Support',
      description: 'Answers customers: orders, returns, small refunds, customer notes and blocks',
      permissions: [
        'customers.view',
        'customers.manage',
        'orders.view',
        'orders.call',
        'returns.manage',
        'refunds.manage',
        'products.view',
      ],
    },
    {
      name: 'Accountant',
      description: 'View-only access to money: orders, ledgers, costs and exports',
      permissions: [
        'orders.view',
        'customers.view',
        'b2b.view',
        'suppliers.view',
        'affiliates.view',
        'coupons.view',
        'products.view',
        'products.view_cost',
        'products.export',
        'inventory.view',
        'inventory.export',
      ],
    },
  ];
