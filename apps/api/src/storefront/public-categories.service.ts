import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from './images';
import type { CategoryNode, Crumb } from './public.dto';

export interface PublicCategory {
  id: string;
  parentId: string | null;
  path: string;
  slug: string;
  nameEn: string;
  nameBn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  showOnHome: boolean;
  updatedAt: Date;
  node: CategoryNode;
  banner: Parameters<ImageService['set']>[0] | null;
}

export interface PublicCategoryTree {
  roots: CategoryNode[];
  /** Parents before children, siblings in display order. */
  list: PublicCategory[];
  byId: Map<string, PublicCategory>;
  bySlug: Map<string, PublicCategory>;
}

const mediaSelect = { select: { storageKey: true, width: true, height: true, alt: true } };

/** Active categories whose whole ancestor chain is active (an inactive parent hides its subtree). */
@Injectable()
export class PublicCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageService,
  ) {}

  async tree(): Promise<PublicCategoryTree> {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }, { id: 'asc' }],
      include: { image: mediaSelect, icon: mediaSelect, banner: mediaSelect },
    });
    const children = new Map<string | null, typeof rows>();
    for (const r of rows) {
      const list = children.get(r.parentId) ?? [];
      list.push(r);
      children.set(r.parentId, list);
    }
    const list: PublicCategory[] = [];
    const byId = new Map<string, PublicCategory>();
    const bySlug = new Map<string, PublicCategory>();
    const build = (parentId: string | null): CategoryNode[] =>
      (children.get(parentId) ?? []).map((r) => {
        const node: CategoryNode = {
          id: r.id,
          slug: r.slug,
          nameEn: r.nameEn,
          nameBn: r.nameBn,
          level: r.level,
          chipColor: r.chipColor,
          image: this.images.setOrNull(r.image, r.nameEn),
          icon: this.images.setOrNull(r.icon, r.nameEn),
          children: [],
        };
        const entry: PublicCategory = {
          id: r.id,
          parentId: r.parentId,
          path: r.path,
          slug: r.slug,
          nameEn: r.nameEn,
          nameBn: r.nameBn,
          descriptionEn: r.descriptionEn,
          descriptionBn: r.descriptionBn,
          seoTitle: r.seoTitle,
          seoDescription: r.seoDescription,
          showOnHome: r.showOnHome,
          updatedAt: r.updatedAt,
          node,
          banner: r.banner,
        };
        list.push(entry);
        byId.set(r.id, entry);
        bySlug.set(r.slug, entry);
        node.children = build(r.id);
        return node;
      });
    // Roots only: rows under an inactive parent are never reached, so they stay hidden.
    const roots = build(null);
    return { roots, list, byId, bySlug };
  }

  /** Root-first breadcrumb for a category path (`/a/b/c/`). Hidden ancestors are skipped. */
  breadcrumb(tree: PublicCategoryTree, path: string): Crumb[] {
    const crumbs: Crumb[] = [];
    for (const id of path.split('/').filter(Boolean)) {
      const c = tree.byId.get(id);
      if (c) crumbs.push({ slug: c.slug, nameEn: c.nameEn, nameBn: c.nameBn });
    }
    return crumbs;
  }
}
