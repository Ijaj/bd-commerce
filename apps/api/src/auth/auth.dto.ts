import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from './password';
import { ALL_PERMISSIONS } from './permissions';

const totpCode = z.string().regex(/^\d{6}$/, '6-digit code');

export class LoginDto extends createZodDto(
  z.object({ email: z.email().max(254), password: z.string().min(1).max(256) }),
) {}

export class LoginResultDto extends createZodDto(
  z.object({ next: z.enum(['authenticated', 'mfa_setup', 'mfa_verify']) }),
) {}

export class TotpSetupDto extends createZodDto(
  z.object({ secret: z.string(), otpauthUri: z.string() }),
) {}

export class TotpCodeDto extends createZodDto(z.object({ code: totpCode })) {}

export class BackupCodesDto extends createZodDto(z.object({ backupCodes: z.array(z.string()) })) {}

export class MfaVerifyDto extends createZodDto(
  z
    .object({ code: totpCode.optional(), backupCode: z.string().min(8).max(20).optional() })
    .refine((v) => (v.code === undefined) !== (v.backupCode === undefined), {
      message: 'Send either code or backupCode',
    }),
) {}

export class ChangePasswordDto extends createZodDto(
  z.object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH).max(256),
  }),
) {}

export const permissionKey = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

export class MeDto extends createZodDto(
  z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    roles: z.array(z.object({ id: z.uuid(), name: z.string() })),
    permissions: z.array(permissionKey),
  }),
) {}
