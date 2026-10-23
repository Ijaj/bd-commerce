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
} as const satisfies Record<string, { group: string; description: string }>;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const OWNER_ROLE = 'Owner';
