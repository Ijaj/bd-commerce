import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import type { CarouselSlide, Media, SlideLang } from '../generated/prisma/client';
import { imgproxyConfig, imgproxyUrl } from '../media/imgproxy';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSlideDto, SlideView, UpdateSlideDto } from './carousel.dto';

const include = { imageDesktop: true, imageMobile: true } as const;
type SlideRow = CarouselSlide & { imageDesktop: Media; imageMobile: Media | null };

@Injectable()
export class CarouselService {
  private readonly imgproxy;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) env: Env,
  ) {
    this.imgproxy = imgproxyConfig(env);
  }

  private ref(m: Media) {
    return {
      id: m.id,
      url: imgproxyUrl(this.imgproxy, m.storageKey, { width: 1200, resize: 'fit' }),
      thumbUrl: imgproxyUrl(this.imgproxy, m.storageKey, {
        width: 240,
        height: 100,
        resize: 'fill',
      }),
    };
  }

  private view(s: SlideRow): SlideView {
    return {
      id: s.id,
      title: s.title,
      linkUrl: s.linkUrl,
      startsAt: s.startsAt?.toISOString() ?? null,
      endsAt: s.endsAt?.toISOString() ?? null,
      sort: s.sort,
      isActive: s.isActive,
      lang: s.lang,
      imageDesktop: this.ref(s.imageDesktop),
      imageMobile: s.imageMobile ? this.ref(s.imageMobile) : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async list(): Promise<SlideView[]> {
    const rows = await this.prisma.carouselSlide.findMany({
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include,
    });
    return rows.map((r) => this.view(r));
  }

  /** Slides the shop shows now: active, inside their time window, matching the language. */
  activeSlides(lang: 'en' | 'bn' | undefined, now = new Date()) {
    const langs: SlideLang[] = lang ? ['all', lang] : ['all', 'en', 'bn'];
    return this.prisma.carouselSlide.findMany({
      where: {
        isActive: true,
        lang: { in: langs },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include,
    });
  }

  async create(body: CreateSlideDto): Promise<SlideView> {
    await this.assertMedia([body.imageDesktopMediaId, body.imageMobileMediaId]);
    this.assertWindow(body.startsAt, body.endsAt);
    const last = await this.prisma.carouselSlide.aggregate({ _max: { sort: true } });
    const row = await this.prisma.carouselSlide.create({
      data: {
        title: body.title,
        imageDesktopMediaId: body.imageDesktopMediaId,
        imageMobileMediaId: body.imageMobileMediaId ?? null,
        linkUrl: body.linkUrl ?? null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        isActive: body.isActive ?? true,
        lang: body.lang ?? 'all',
        sort: (last._max.sort ?? -1) + 1,
      },
      include,
    });
    return this.view(row);
  }

  async update(id: string, body: UpdateSlideDto): Promise<SlideView> {
    const current = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Slide not found');
    await this.assertMedia([body.imageDesktopMediaId, body.imageMobileMediaId]);
    this.assertWindow(
      body.startsAt === undefined ? current.startsAt?.toISOString() : body.startsAt,
      body.endsAt === undefined ? current.endsAt?.toISOString() : body.endsAt,
    );
    const row = await this.prisma.carouselSlide.update({
      where: { id },
      data: {
        title: body.title,
        imageDesktopMediaId: body.imageDesktopMediaId,
        imageMobileMediaId: body.imageMobileMediaId,
        linkUrl: body.linkUrl,
        startsAt:
          body.startsAt === undefined ? undefined : body.startsAt && new Date(body.startsAt),
        endsAt: body.endsAt === undefined ? undefined : body.endsAt && new Date(body.endsAt),
        isActive: body.isActive,
        lang: body.lang,
      },
      include,
    });
    return this.view(row);
  }

  async remove(id: string) {
    const { count } = await this.prisma.carouselSlide.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('Slide not found');
  }

  /** Listed ids take the first positions in order; slides not listed keep their relative order after them. */
  async reorder(ids: string[]) {
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate ids');
    await this.prisma.$transaction(async (tx) => {
      const all = await tx.carouselSlide.findMany({
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const known = new Set(all.map((s) => s.id));
      if (ids.some((id) => !known.has(id))) throw new BadRequestException('Unknown slide id');
      const listed = new Set(ids);
      const order = [...ids, ...all.map((s) => s.id).filter((id) => !listed.has(id))];
      await Promise.all(
        order.map((id, sort) => tx.carouselSlide.update({ where: { id }, data: { sort } })),
      );
    });
  }

  private assertWindow(startsAt: string | null | undefined, endsAt: string | null | undefined) {
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private async assertMedia(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    if (wanted.length === 0) return;
    const found = await this.prisma.media.count({ where: { id: { in: wanted } } });
    if (found !== wanted.length) throw new BadRequestException('Unknown media id');
  }
}
