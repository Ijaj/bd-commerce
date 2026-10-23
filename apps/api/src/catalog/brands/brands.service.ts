import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import type { Brand } from '../../generated/prisma/client';
import { imgproxyConfig, imgproxyUrl } from '../../media/imgproxy';
import { PrismaService } from '../../prisma/prisma.service';
import { pickSlug, rethrowUnique, slugify } from '../products/slug';
import type { BrandView, CreateBrandDto, UpdateBrandDto } from './brands.dto';

type BrandRow = Brand & { logo: { storageKey: string } | null; _count: { products: number } };

@Injectable()
export class BrandsService {
  private readonly imgproxy;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) env: Env,
  ) {
    this.imgproxy = imgproxyConfig(env);
  }

  private view(b: BrandRow): BrandView {
    return {
      id: b.id,
      nameEn: b.nameEn,
      nameBn: b.nameBn,
      slug: b.slug,
      logoMediaId: b.logoMediaId,
      logoUrl: b.logo
        ? imgproxyUrl(this.imgproxy, b.logo.storageKey, {
            width: 200,
            height: 200,
            resize: 'fill',
          })
        : null,
      active: b.active,
      productCount: b._count.products,
      createdAt: b.createdAt.toISOString(),
    };
  }

  private readonly include = {
    logo: { select: { storageKey: true } },
    _count: { select: { products: true } },
  } as const;

  async list(): Promise<BrandView[]> {
    const rows = await this.prisma.brand.findMany({
      orderBy: { nameEn: 'asc' },
      include: this.include,
    });
    return rows.map((b) => this.view(b));
  }

  private async assertMedia(id: string | null | undefined) {
    if (!id) return;
    if (!(await this.prisma.media.findUnique({ where: { id }, select: { id: true } }))) {
      throw new BadRequestException('Logo media not found');
    }
  }

  async create(body: CreateBrandDto): Promise<BrandView> {
    await this.assertMedia(body.logoMediaId);
    let slug = body.slug;
    if (slug) {
      if (await this.prisma.brand.findUnique({ where: { slug } })) {
        throw new ConflictException(`Slug "${slug}" is already used`);
      }
    } else {
      const base = slugify(body.nameEn) || 'brand';
      const taken = await this.prisma.brand.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      });
      slug = pickSlug(base, new Set(taken.map((t) => t.slug)));
    }
    const created = await this.prisma.brand
      .create({
        data: {
          nameEn: body.nameEn,
          nameBn: body.nameBn || null,
          slug,
          logoMediaId: body.logoMediaId ?? null,
          active: body.active ?? true,
        },
        include: this.include,
      })
      .catch((e) => rethrowUnique(e, 'Slug already used'));
    return this.view(created);
  }

  async update(id: string, body: UpdateBrandDto): Promise<BrandView> {
    const current = await this.prisma.brand.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Brand not found');
    await this.assertMedia(body.logoMediaId);
    if (body.slug && body.slug !== current.slug) {
      if (await this.prisma.brand.findUnique({ where: { slug: body.slug } })) {
        throw new ConflictException(`Slug "${body.slug}" is already used`);
      }
    }
    const updated = await this.prisma.brand
      .update({
        where: { id },
        data: {
          nameEn: body.nameEn,
          nameBn: body.nameBn === undefined ? undefined : body.nameBn || null,
          slug: body.slug,
          logoMediaId: body.logoMediaId,
          active: body.active,
        },
        include: this.include,
      })
      .catch((e) => rethrowUnique(e, 'Slug already used'));
    return this.view(updated);
  }

  /** 409 while products use the brand; `force` detaches them (brand_id = null) and deletes. */
  async remove(id: string, force: boolean) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    const count = brand._count.products;
    if (count > 0 && !force) {
      throw new ConflictException(
        `${count} product${count === 1 ? ' uses' : 's use'} this brand; pass force=true to detach them`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.product.updateMany({ where: { brandId: id }, data: { brandId: null } }),
      this.prisma.brand.delete({ where: { id } }),
    ]);
  }
}
