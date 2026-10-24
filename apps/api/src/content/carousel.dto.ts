import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const mediaRef = z.object({
  id: z.uuid(),
  /// imgproxy 1200 wide, WebP
  url: z.string(),
  /// imgproxy 240x100 fill, WebP
  thumbUrl: z.string(),
});

const slideSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  linkUrl: z.string().nullable(),
  startsAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
  sort: z.number().int(),
  isActive: z.boolean(),
  lang: z.enum(['all', 'en', 'bn']),
  imageDesktop: mediaRef,
  imageMobile: mediaRef.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SlideView = z.infer<typeof slideSchema>;
export class SlideDto extends createZodDto(slideSchema) {}
export class SlideListDto extends createZodDto(z.array(slideSchema)) {}

// Relative shop path (`/p/slug`) or absolute http(s) URL; never `javascript:` and friends.
const linkUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v), {
    message: 'Use a shop path like /c/phones or an http(s) URL',
  });
const title = z.string().trim().min(1).max(120);
const when = z.iso.datetime({ offset: true }).nullable();

const fields = {
  title,
  imageDesktopMediaId: z.uuid(),
  imageMobileMediaId: z.uuid().nullable(),
  linkUrl: linkUrl.nullable(),
  startsAt: when,
  endsAt: when,
  isActive: z.boolean(),
  lang: z.enum(['all', 'en', 'bn']),
};

export class CreateSlideDto extends createZodDto(
  z.object({
    title: fields.title,
    imageDesktopMediaId: fields.imageDesktopMediaId,
    imageMobileMediaId: fields.imageMobileMediaId.optional(),
    linkUrl: fields.linkUrl.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    isActive: fields.isActive.optional(),
    lang: fields.lang.optional(),
  }),
) {}

export class UpdateSlideDto extends createZodDto(
  z.object({
    title: fields.title.optional(),
    imageDesktopMediaId: fields.imageDesktopMediaId.optional(),
    imageMobileMediaId: fields.imageMobileMediaId.optional(),
    linkUrl: fields.linkUrl.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    isActive: fields.isActive.optional(),
    lang: fields.lang.optional(),
  }),
) {}

export class SlideOrderDto extends createZodDto(z.object({ ids: z.array(z.uuid()).max(200) })) {}
