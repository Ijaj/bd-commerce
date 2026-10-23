import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const mediaSchema = z.object({
  id: z.uuid(),
  mime: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  bytes: z.number().int(),
  alt: z.string().nullable(),
  /// imgproxy 600x600 fit, WebP
  url: z.string(),
  /// imgproxy 160x160 fill, WebP
  thumbUrl: z.string(),
  createdAt: z.iso.datetime(),
});

export class MediaDto extends createZodDto(mediaSchema) {}

const alt = z.string().trim().max(300);

/** Multipart text field next to `file`. */
export class UploadMediaDto extends createZodDto(
  z.object({ alt: alt.optional().transform((v) => v || undefined) }),
) {}

export class UpdateMediaDto extends createZodDto(
  z.object({ alt: alt.nullable().transform((v) => v || null) }),
) {}
