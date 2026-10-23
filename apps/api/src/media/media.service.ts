import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import { ENV, type Env } from '../config/env';
import type { Media } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { imgproxyConfig, imgproxyUrl } from './imgproxy';
import type { MediaDto } from './media.dto';
import { ObjectStorage } from './object-storage';
import { uuidv7 } from './uuid';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type Kind = 'jpeg' | 'png' | 'webp' | 'avif' | 'gif';

const KINDS: Record<Kind, { mime: string; ext: string }> = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  avif: { mime: 'image/avif', ext: 'avif' },
  gif: { mime: 'image/gif', ext: 'gif' },
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Media upload is allowed with products.edit or categories.edit. */
  assertCanManage({ permissions }: StaffAuthContext) {
    if (!permissions.has('products.edit') && !permissions.has('categories.edit')) {
      throw new ForbiddenException('Missing permission: products.edit or categories.edit');
    }
  }

  toDto(media: Media): MediaDto {
    const cfg = imgproxyConfig(this.env);
    return {
      id: media.id,
      mime: media.mime,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
      alt: media.alt,
      url: imgproxyUrl(cfg, media.storageKey, { width: 600, height: 600, resize: 'fit' }),
      thumbUrl: imgproxyUrl(cfg, media.storageKey, { width: 160, height: 160, resize: 'fill' }),
      createdAt: media.createdAt.toISOString(),
    };
  }

  async upload(actor: StaffAuthContext, file: Buffer, alt: string | undefined): Promise<MediaDto> {
    const processed = await this.process(file);
    const { mime, ext } = KINDS[processed.kind];
    const now = new Date();
    const key = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${uuidv7()}.${ext}`;

    await this.storage.put(key, processed.body, mime);
    try {
      const media = await this.prisma.media.create({
        data: {
          storageKey: key,
          mime,
          width: processed.width,
          height: processed.height,
          bytes: processed.body.length,
          alt,
          uploadedById: actor.staff.id,
        },
      });
      return this.toDto(media);
    } catch (err) {
      await this.storage.delete(key).catch(() => undefined);
      throw err;
    }
  }

  async get(id: string): Promise<MediaDto> {
    return this.toDto(await this.find(id));
  }

  async update(id: string, alt: string | null): Promise<MediaDto> {
    await this.find(id);
    return this.toDto(await this.prisma.media.update({ where: { id }, data: { alt } }));
  }

  async remove(id: string): Promise<void> {
    const media = await this.find(id);
    const [images, brands, categories] = await Promise.all([
      this.prisma.productImage.count({ where: { mediaId: id } }),
      this.prisma.brand.count({ where: { logoMediaId: id } }),
      this.prisma.category.count({
        where: { OR: [{ imageMediaId: id }, { iconMediaId: id }, { bannerMediaId: id }] },
      }),
    ]);
    if (images + brands + categories > 0) {
      throw new ConflictException('Image is in use by a product, brand or category');
    }
    try {
      await this.prisma.media.delete({ where: { id } });
    } catch (err) {
      // A product image was attached between the check and the delete (FK restrict).
      if ((err as { code?: string }).code === 'P2003') {
        throw new ConflictException('Image is in use by a product, brand or category');
      }
      throw err;
    }
    await this.storage
      .delete(media.storageKey)
      .catch((err: unknown) =>
        this.logger.error(`Could not delete object ${media.storageKey}: ${String(err)}`),
      );
  }

  private async find(id: string): Promise<Media> {
    const media = await this.prisma.media.findUnique({ where: { id } });
    if (!media) throw new NotFoundException('Image not found');
    return media;
  }

  /** Detects the real format, applies EXIF rotation and re-encodes without metadata. */
  private async process(input: Buffer) {
    try {
      const meta = await sharp(input, { animated: true }).metadata();
      const kind = detectKind(meta);
      if (!kind)
        throw new BadRequestException('Only JPEG, PNG, WebP, AVIF and GIF images are allowed');

      const animated = (meta.pages ?? 1) > 1;
      let body: Buffer;
      if (animated) {
        // Re-encoding would drop frames for some formats; animated files are kept as uploaded.
        body = input;
      } else {
        const pipeline = sharp(input).rotate();
        switch (kind) {
          case 'jpeg':
            pipeline.jpeg({ quality: 90, mozjpeg: true });
            break;
          case 'png':
            pipeline.png();
            break;
          case 'webp':
            pipeline.webp({ quality: 90 });
            break;
          case 'avif':
            pipeline.avif({ quality: 70 });
            break;
          case 'gif':
            pipeline.gif();
            break;
        }
        body = await pipeline.toBuffer();
      }
      const out = await sharp(body, { animated: true }).metadata();
      const width = out.width;
      const height = out.pageHeight ?? out.height;
      if (!width || !height) throw new BadRequestException('Could not read image size');
      return { kind, body, width, height };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid or unsupported image');
    }
  }
}

function detectKind(meta: sharp.Metadata): Kind | null {
  switch (meta.format) {
    case 'jpeg':
    case 'png':
    case 'webp':
    case 'gif':
      return meta.format;
    case 'heif':
      return meta.compression === 'av1' ? 'avif' : null;
    default:
      return null;
  }
}
