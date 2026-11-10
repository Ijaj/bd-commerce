import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { sanitizeDescriptionHtml } from '../catalog/html/sanitize';
import { type Page, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PageCreateDto,
  PageFullView,
  PageRowView,
  PageUpdateDto,
  PublicPageListView,
  PublicPageView,
} from './pages.dto';

/** Slugs the admin editor routes use, so a page can never shadow them. */
const RESERVED = new Set(['new', 'edit']);

const clean = (v: string | null | undefined) => (v ? sanitizeDescriptionHtml(v) || null : null);

function row(p: Page): PageRowView {
  return {
    id: p.id,
    slug: p.slug,
    titleEn: p.titleEn,
    titleBn: p.titleBn,
    isPublished: p.isPublished,
    showInFooter: p.showInFooter,
    sortOrder: p.sortOrder,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function full(p: Page): PageFullView {
  return {
    ...row(p),
    bodyHtmlEn: p.bodyHtmlEn,
    bodyHtmlBn: p.bodyHtmlBn,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    createdAt: p.createdAt.toISOString(),
  };
}

const notFound = () => new NotFoundException({ code: 'PAGE_NOT_FOUND', message: 'Page not found' });

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  private checkSlug(slug: string | undefined) {
    if (slug && RESERVED.has(slug)) {
      throw new UnprocessableEntityException({
        code: 'PAGE_SLUG_RESERVED',
        message: `"${slug}" is reserved`,
      });
    }
  }

  private async write<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException({ code: 'PAGE_SLUG_TAKEN', message: 'Slug already in use' });
        }
        if (e.code === 'P2025') throw notFound();
      }
      throw e;
    }
  }

  async list(): Promise<PageRowView[]> {
    const rows = await this.prisma.page.findMany({
      orderBy: [{ sortOrder: 'asc' }, { titleEn: 'asc' }, { id: 'asc' }],
    });
    return rows.map(row);
  }

  async get(id: string): Promise<PageFullView> {
    const p = await this.prisma.page.findUnique({ where: { id } });
    if (!p) throw notFound();
    return full(p);
  }

  async create(input: PageCreateDto): Promise<PageFullView> {
    this.checkSlug(input.slug);
    const p = await this.write(() =>
      this.prisma.page.create({
        data: {
          ...input,
          bodyHtmlEn: clean(input.bodyHtmlEn),
          bodyHtmlBn: clean(input.bodyHtmlBn),
        },
      }),
    );
    return full(p);
  }

  async update(id: string, input: PageUpdateDto): Promise<PageFullView> {
    this.checkSlug(input.slug);
    const data = { ...input };
    if (input.bodyHtmlEn !== undefined) data.bodyHtmlEn = clean(input.bodyHtmlEn);
    if (input.bodyHtmlBn !== undefined) data.bodyHtmlBn = clean(input.bodyHtmlBn);
    const p = await this.write(() => this.prisma.page.update({ where: { id }, data }));
    return full(p);
  }

  async remove(id: string): Promise<void> {
    await this.write(() => this.prisma.page.delete({ where: { id } }));
  }

  async publicList(): Promise<PublicPageListView> {
    const rows = await this.prisma.page.findMany({
      where: { isPublished: true, showInFooter: true },
      orderBy: [{ sortOrder: 'asc' }, { titleEn: 'asc' }],
    });
    return {
      items: rows.map((p) => ({ slug: p.slug, titleEn: p.titleEn, titleBn: p.titleBn })),
    };
  }

  async publicGet(slug: string): Promise<PublicPageView> {
    const p = await this.prisma.page.findFirst({ where: { slug, isPublished: true } });
    if (!p) throw notFound();
    return {
      slug: p.slug,
      titleEn: p.titleEn,
      titleBn: p.titleBn,
      bodyHtmlEn: p.bodyHtmlEn,
      bodyHtmlBn: p.bodyHtmlBn,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
