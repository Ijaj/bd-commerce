import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { permissionKey } from '../auth/auth.dto';

const roleRef = z.object({ id: z.uuid(), name: z.string() });

export const staffSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  disabled: z.boolean(),
  totpEnabled: z.boolean(),
  sessionTimeoutMin: z.number().int().nullable(),
  lastLoginAt: z.iso.datetime().nullable(),
  roles: z.array(roleRef),
});

export class StaffDto extends createZodDto(staffSchema) {}
export class StaffListDto extends createZodDto(z.array(staffSchema)) {}

export class CreateStaffDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    phone: z.string().trim().max(20).optional(),
    roleIds: z.array(z.uuid()).max(20).default([]),
  }),
) {}

export class CreatedStaffDto extends createZodDto(
  z.object({ staff: staffSchema, tempPassword: z.string() }),
) {}

export class UpdateStaffDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    sessionTimeoutMin: z
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .nullable()
      .optional(),
    roleIds: z.array(z.uuid()).max(20).optional(),
    disabled: z.boolean().optional(),
  }),
) {}

const roleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  permissions: z.array(permissionKey),
  staffCount: z.number().int(),
});

export class RoleDto extends createZodDto(roleSchema) {}
export class RoleListDto extends createZodDto(z.array(roleSchema)) {}

export class CreateRoleDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(60),
    description: z.string().trim().max(300).optional(),
    permissions: z.array(permissionKey).max(500),
  }),
) {}

export class UpdateRoleDto extends createZodDto(
  z.object({
    name: z.string().trim().min(1).max(60).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    permissions: z.array(permissionKey).max(500).optional(),
  }),
) {}

export class PermissionListDto extends createZodDto(
  z.array(z.object({ key: permissionKey, group: z.string(), description: z.string() })),
) {}
