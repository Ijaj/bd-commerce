import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const settingSchema = z.object({
  key: z.string(),
  group: z.string(),
  description: z.string(),
  public: z.boolean(),
  value: z.unknown(),
  default: z.unknown(),
  isDefault: z.boolean(),
  /** JSON Schema of the value, for rendering the admin form. */
  schema: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export class SettingListDto extends createZodDto(z.array(settingSchema)) {}

export class SetSettingDto extends createZodDto(z.object({ value: z.unknown() })) {}

const localized = z.object({ en: z.string(), bn: z.string() });

export class SiteStatusDto extends createZodDto(
  z.object({
    maintenance: z.object({ enabled: z.boolean(), message: localized }),
    announcement: z.object({ text: localized, link: z.string().nullable() }).nullable(),
    flags: z.object({
      online_payments_enabled: z.boolean(),
      advance_payments_enabled: z.boolean(),
      preorders_enabled: z.boolean(),
    }),
  }),
) {}
