import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { StaffAuthContext } from '../../auth/staff-auth.service';
import { ENV, type Env } from '../../config/env';
import {
  type AttributeOption,
  type Category,
  type CategoryAttribute,
  Prisma,
} from '../../generated/prisma/client';
import { imgproxyConfig, imgproxyUrl } from '../../media/imgproxy';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AttributeDto,
  CategoryDetailDto,
  CategoryDto,
  CreateAttributeDto,
  CreateCategoryDto,
  DeleteCategoryDto,
  DeletePreviewDto,
  SetOptionsDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
} from './categories.dto';

export const MAX_LEVEL = 4;
const OPTION_TYPES = new Set(['select', 'multiselect']);
const DEPTH_MESSAGE = `Categories can be at most ${MAX_LEVEL} levels deep`;

type Tx = Prisma.TransactionClient;
export type AttributeWithOptions = CategoryAttribute & { options: AttributeOption[] };

const withOptions = {
  options: { orderBy: { sort: 'asc' } },
} satisfies Prisma.CategoryAttributeInclude;

function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Ids on a materialized path (`/a/b/c/`), root first. */
function pathIds(path: string) {
  return path.split('/').filter(Boolean);
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toAttributeDto(a: AttributeWithOptions): AttributeDto {
  return {
    id: a.id,
    categoryId: a.categoryId,
    key: a.key,
    nameEn: a.nameEn,
    nameBn: a.nameBn,
    type: a.type,
    unit: a.unit,
    isFilterable: a.isFilterable,
    isRequired: a.isRequired,
    sort: a.sort,
    options: a.options.map((o) => ({
      id: o.id,
      valueEn: o.valueEn,
      valueBn: o.valueBn,
      sort: o.sort,
    })),
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---- reads used by other modules ----

  /** The category and all its descendants (ids), via the materialized path. */
  async subtreeIds(categoryId: string): Promise<string[]> {
    const cat = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { path: true },
    });
    if (!cat) throw new NotFoundException('Category not found');
    const rows = await this.prisma.category.findMany({
      where: { path: { startsWith: cat.path } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Attributes of the given categories and of all their ancestors, with options. */
  async inheritedAttributes(categoryIds: string[]): Promise<AttributeWithOptions[]> {
    if (!categoryIds.length) return [];
    const cats = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { path: true },
    });
    const ids = [...new Set(cats.flatMap((c) => pathIds(c.path)))];
    const rows = await this.prisma.categoryAttribute.findMany({
      where: { categoryId: { in: ids } },
      include: { ...withOptions, category: { select: { level: true } } },
      orderBy: [{ category: { level: 'asc' } }, { sort: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(({ category: _category, ...attr }) => attr);
  }

  // ---- categories ----

  async list(): Promise<CategoryDto[]> {
    const [rows, links] = await Promise.all([
      this.prisma.category.findMany({ include: { image: true, icon: true, banner: true } }),
      this.prisma.productCategory.groupBy({ by: ['categoryId'], _count: { _all: true } }),
    ]);
    const productCounts = new Map(links.map((l) => [l.categoryId, l._count._all]));
    const byParent = new Map<string | null, typeof rows>();
    for (const row of rows) {
      const siblings = byParent.get(row.parentId) ?? [];
      siblings.push(row);
      byParent.set(row.parentId, siblings);
    }
    const out: CategoryDto[] = [];
    const walk = (parentId: string | null) => {
      const siblings = (byParent.get(parentId) ?? []).sort(
        (a, b) => a.sort - b.sort || a.nameEn.localeCompare(b.nameEn),
      );
      for (const row of siblings) {
        out.push(
          this.toDto(row, productCounts.get(row.id) ?? 0, byParent.get(row.id)?.length ?? 0),
        );
        walk(row.id);
      }
    };
    walk(null);
    return out;
  }

  async get(id: string): Promise<CategoryDetailDto> {
    const cat = await this.load(id);
    const [productCount, childCount, own, inheritedAll] = await Promise.all([
      this.prisma.productCategory.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.categoryAttribute.findMany({
        where: { categoryId: id },
        include: withOptions,
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      }),
      this.inheritedAttributes(pathIds(cat.path).filter((x) => x !== id)),
    ]);
    const ancestors = await this.prisma.category.findMany({
      where: { id: { in: pathIds(cat.path) } },
      select: { id: true, nameEn: true },
    });
    const names = new Map(ancestors.map((a) => [a.id, a.nameEn]));
    const full = await this.prisma.category.findUniqueOrThrow({
      where: { id },
      include: { image: true, icon: true, banner: true },
    });
    return {
      ...this.toDto(full, productCount, childCount),
      attributes: own.map(toAttributeDto),
      inheritedAttributes: inheritedAll
        .filter((a) => a.categoryId !== id)
        .map((a) => ({
          ...toAttributeDto(a),
          inheritedFrom: { id: a.categoryId, nameEn: names.get(a.categoryId) ?? '' },
        })),
    };
  }

  async create(actor: StaffAuthContext, input: CreateCategoryDto): Promise<CategoryDto> {
    const parent = input.parentId ? await this.load(input.parentId) : null;
    const level = (parent?.level ?? 0) + 1;
    if (level > MAX_LEVEL) throw new BadRequestException(DEPTH_MESSAGE);
    if (level === 1 && !input.imageMediaId) {
      throw new BadRequestException('Main categories need an image');
    }
    if (input.showOnHome) this.assertCanSetHome(actor, level);
    await this.assertMedia([input.imageMediaId, input.iconMediaId, input.bannerMediaId]);

    const slug = input.slug ?? (await this.uniqueSlug(slugify(input.nameEn) || 'category'));
    const sort = input.sort ?? (await this.nextSort(parent?.id ?? null));
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const created = await tx.category.create({
          data: {
            parentId: parent?.id ?? null,
            level,
            path: '',
            nameEn: input.nameEn,
            nameBn: input.nameBn,
            slug,
            descriptionEn: input.descriptionEn,
            descriptionBn: input.descriptionBn,
            imageMediaId: input.imageMediaId,
            iconMediaId: input.iconMediaId,
            bannerMediaId: input.bannerMediaId,
            chipColor: input.chipColor,
            sort,
            isActive: input.isActive,
            showOnHome: input.showOnHome,
            returnWindowDays: input.returnWindowDays,
            seoTitle: input.seoTitle,
            seoDescription: input.seoDescription,
          },
        });
        // The id is only known after insert, so the path is filled in right away.
        await tx.category.update({
          where: { id: created.id },
          data: { path: `${parent?.path ?? '/'}${created.id}/` },
        });
        return created.id;
      });
      return this.one(id);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Slug already in use');
      throw err;
    }
  }

  async update(
    actor: StaffAuthContext,
    id: string,
    input: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    const cat = await this.load(id);
    const { parentId, ...fields } = input;

    const moving = parentId !== undefined && parentId !== cat.parentId;
    const newParent = moving && parentId ? await this.load(parentId) : null;
    const level = moving ? (newParent?.level ?? 0) + 1 : cat.level;

    if (moving) {
      if (newParent && (newParent.id === cat.id || newParent.path.startsWith(cat.path))) {
        throw new BadRequestException('A category cannot be moved under itself or its descendants');
      }
      const maxLevel = await this.maxLevelUnder(this.prisma, cat.path);
      if (level + (maxLevel - cat.level) > MAX_LEVEL) throw new BadRequestException(DEPTH_MESSAGE);
    }

    const imageMediaId = fields.imageMediaId === undefined ? cat.imageMediaId : fields.imageMediaId;
    if (level === 1 && !imageMediaId)
      throw new BadRequestException('Main categories need an image');

    const showOnHome = fields.showOnHome ?? cat.showOnHome;
    if (fields.showOnHome !== undefined && fields.showOnHome !== cat.showOnHome) {
      this.assertCanSetHome(actor, level);
    }
    if (showOnHome && level !== 1) {
      throw new BadRequestException('Only main categories can be shown on the home page');
    }
    await this.assertMedia([fields.imageMediaId, fields.iconMediaId, fields.bannerMediaId]);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (moving) {
          await this.assertNoKeyClash(tx, cat.path, newParent ? pathIds(newParent.path) : []);
          await this.relocate(tx, cat, newParent);
        }
        await tx.category.update({ where: { id }, data: fields });
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Slug already in use');
      throw err;
    }
    return this.one(id);
  }

  async reorder(items: { id: string; sort: number }[]): Promise<void> {
    const rows = await this.prisma.category.findMany({
      where: { id: { in: items.map((i) => i.id) } },
      select: { id: true, parentId: true },
    });
    if (rows.length !== new Set(items.map((i) => i.id)).size) {
      throw new NotFoundException('Category not found');
    }
    if (new Set(rows.map((r) => r.parentId)).size > 1) {
      throw new BadRequestException(
        'Only categories with the same parent can be reordered together',
      );
    }
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.category.update({ where: { id: i.id }, data: { sort: i.sort } }),
      ),
    );
  }

  async deletePreview(id: string): Promise<DeletePreviewDto> {
    const cat = await this.load(id);
    const ids = (
      await this.prisma.category.findMany({
        where: { path: { startsWith: cat.path } },
        select: { id: true },
      })
    ).map((c) => c.id);
    const [productCount, primaryProductCount] = await Promise.all([
      this.prisma.product.count({ where: { categories: { some: { categoryId: { in: ids } } } } }),
      this.prisma.product.count({ where: { primaryCategoryId: { in: ids } } }),
    ]);
    return { subCategoryCount: ids.length - 1, productCount, primaryProductCount };
  }

  async remove(actor: StaffAuthContext, id: string, input: DeleteCategoryDto): Promise<void> {
    const needed = input.mode === 'move' ? 'categories.delete' : 'categories.delete_with_products';
    if (!actor.permissions.has(needed))
      throw new ForbiddenException(`Missing permission: ${needed}`);
    const cat = await this.load(id);
    if (input.mode === 'cascade') return this.removeCascade(cat);
    return this.removeMove(cat, input.targetId as string);
  }

  private async removeMove(cat: Category, targetId: string) {
    const target = await this.load(targetId);
    if (target.id === cat.id || target.path.startsWith(cat.path)) {
      throw new BadRequestException(
        'The target cannot be the category itself or one of its sub-categories',
      );
    }
    const children = await this.prisma.category.findMany({ where: { parentId: cat.id } });
    for (const child of children) {
      const maxLevel = await this.maxLevelUnder(this.prisma, child.path);
      if (target.level + 1 + (maxLevel - child.level) > MAX_LEVEL) {
        throw new BadRequestException(
          `Moving "${child.nameEn}" under "${target.nameEn}" would exceed ${MAX_LEVEL} levels`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const child of children) {
        await this.assertNoKeyClash(tx, child.path, pathIds(target.path));
        await this.relocate(tx, child, target);
      }
      const links = await tx.productCategory.findMany({
        where: { categoryId: cat.id },
        select: { productId: true },
      });
      const primaries = await tx.product.findMany({
        where: { primaryCategoryId: cat.id },
        select: { id: true },
      });
      const productIds = new Set([...links.map((l) => l.productId), ...primaries.map((p) => p.id)]);
      await tx.productCategory.createMany({
        data: [...productIds].map((productId) => ({ productId, categoryId: target.id })),
        skipDuplicates: true,
      });
      await tx.product.updateMany({
        where: { primaryCategoryId: cat.id },
        data: { primaryCategoryId: target.id },
      });
      await tx.category.delete({ where: { id: cat.id } });
    });
  }

  private async removeCascade(cat: Category) {
    await this.prisma.$transaction(async (tx) => {
      const ids = (
        await tx.category.findMany({
          where: { path: { startsWith: cat.path } },
          select: { id: true },
        })
      ).map((c) => c.id);
      // Hard delete: no orders exist yet. Once orders do (step 4), products that were ordered
      // are archived instead and only the rest are deleted.
      await tx.product.deleteMany({ where: { primaryCategoryId: { in: ids } } });
      await tx.productCategory.deleteMany({ where: { categoryId: { in: ids } } });
      await tx.category.deleteMany({ where: { id: { in: ids } } });
    });
  }

  // ---- attributes ----

  async createAttribute(categoryId: string, input: CreateAttributeDto): Promise<AttributeDto> {
    const cat = await this.load(categoryId);
    await this.assertKeyFree(cat, input.key);
    try {
      const sort = input.sort ?? (await this.nextAttributeSort(categoryId));
      const created = await this.prisma.categoryAttribute.create({
        data: {
          categoryId,
          key: input.key,
          nameEn: input.nameEn,
          nameBn: input.nameBn,
          type: input.type,
          unit: input.unit,
          isFilterable: input.isFilterable,
          isRequired: input.isRequired,
          sort,
        },
        include: withOptions,
      });
      return toAttributeDto(created);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Attribute key already used here');
      throw err;
    }
  }

  async updateAttribute(attrId: string, input: UpdateAttributeDto): Promise<AttributeDto> {
    const attr = await this.loadAttribute(attrId);
    const typeChanged = input.type !== undefined && input.type !== attr.type;
    await this.prisma.$transaction(async (tx) => {
      if (typeChanged) {
        // Stored product values are typed by the old type; they no longer make sense.
        await tx.productAttributeValue.deleteMany({ where: { attributeId: attrId } });
        if (!OPTION_TYPES.has(input.type as string)) {
          await tx.attributeOption.deleteMany({ where: { attributeId: attrId } });
        }
      }
      await tx.categoryAttribute.update({ where: { id: attrId }, data: input });
    });
    return toAttributeDto(await this.loadAttribute(attrId));
  }

  async removeAttribute(attrId: string): Promise<void> {
    await this.loadAttribute(attrId);
    await this.prisma.categoryAttribute.delete({ where: { id: attrId } });
  }

  async reorderAttributes(categoryId: string, items: { id: string; sort: number }[]) {
    await this.load(categoryId);
    const rows = await this.prisma.categoryAttribute.findMany({
      where: { id: { in: items.map((i) => i.id) }, categoryId },
      select: { id: true },
    });
    if (rows.length !== new Set(items.map((i) => i.id)).size) {
      throw new NotFoundException('Attribute not found in this category');
    }
    await this.prisma.$transaction(
      items.map((i) =>
        this.prisma.categoryAttribute.update({ where: { id: i.id }, data: { sort: i.sort } }),
      ),
    );
  }

  /** Replaces the option list: rows with an id are updated, new ones created, missing ones deleted. */
  async setOptions(attrId: string, input: SetOptionsDto): Promise<AttributeDto['options']> {
    const attr = await this.loadAttribute(attrId);
    if (!OPTION_TYPES.has(attr.type)) {
      throw new BadRequestException('Only select and multiselect attributes have options');
    }
    const rows = input.map((o, index) => ({
      index,
      id: o.id,
      valueEn: o.valueEn.trim(),
      valueBn: o.valueBn?.trim() || null,
    }));
    this.validateOptions(rows);
    const existing = new Set(attr.options.map((o) => o.id));
    const unknown = rows.filter((r) => r.id && !existing.has(r.id));
    if (unknown.length) {
      throw new BadRequestException({
        message: 'Unknown option id',
        rows: unknown.map((r) => ({ index: r.index, field: 'id', reason: 'unknown' })),
      });
    }
    const keep = new Set(rows.flatMap((r) => (r.id ? [r.id] : [])));
    await this.prisma.$transaction(async (tx) => {
      await tx.attributeOption.deleteMany({
        where: { attributeId: attrId, id: { notIn: [...keep] } },
      });
      for (const r of rows) {
        const data = { valueEn: r.valueEn, valueBn: r.valueBn, sort: r.index };
        if (r.id) await tx.attributeOption.update({ where: { id: r.id }, data });
        else await tx.attributeOption.create({ data: { ...data, attributeId: attrId } });
      }
    });
    return (await this.loadAttribute(attrId)).options.map((o) => ({
      id: o.id,
      valueEn: o.valueEn,
      valueBn: o.valueBn,
      sort: o.sort,
    }));
  }

  /** Q116: blank and (case-insensitive, per language) duplicate values are rejected, naming the rows. */
  private validateOptions(rows: { index: number; valueEn: string; valueBn: string | null }[]) {
    const problems: {
      index: number;
      field: 'valueEn' | 'valueBn';
      reason: 'blank' | 'duplicate';
    }[] = [];
    const seen = { valueEn: new Set<string>(), valueBn: new Set<string>() };
    for (const r of rows) {
      if (!r.valueEn) problems.push({ index: r.index, field: 'valueEn', reason: 'blank' });
      for (const field of ['valueEn', 'valueBn'] as const) {
        const value = r[field]?.toLowerCase();
        if (!value) continue;
        if (seen[field].has(value)) problems.push({ index: r.index, field, reason: 'duplicate' });
        seen[field].add(value);
      }
    }
    if (problems.length) {
      throw new BadRequestException({
        message: 'Options must not be blank or duplicated',
        rows: problems,
      });
    }
  }

  // ---- helpers ----

  private async load(id: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  private async loadAttribute(id: string) {
    const attr = await this.prisma.categoryAttribute.findUnique({
      where: { id },
      include: withOptions,
    });
    if (!attr) throw new NotFoundException('Attribute not found');
    return attr;
  }

  private async one(id: string): Promise<CategoryDto> {
    const [row, productCount, childCount] = await Promise.all([
      this.prisma.category.findUniqueOrThrow({
        where: { id },
        include: { image: true, icon: true, banner: true },
      }),
      this.prisma.productCategory.count({ where: { categoryId: id } }),
      this.prisma.category.count({ where: { parentId: id } }),
    ]);
    return this.toDto(row, productCount, childCount);
  }

  private toDto(
    row: Category & {
      image: { id: string; storageKey: string } | null;
      icon: { id: string; storageKey: string } | null;
      banner: { id: string; storageKey: string } | null;
    },
    productCount: number,
    childCount: number,
  ): CategoryDto {
    const cfg = imgproxyConfig(this.env);
    const media = (m: { id: string; storageKey: string } | null) =>
      m
        ? {
            mediaId: m.id,
            url: imgproxyUrl(cfg, m.storageKey, { width: 400, height: 400, resize: 'fit' }),
          }
        : null;
    return {
      id: row.id,
      parentId: row.parentId,
      level: row.level,
      path: row.path,
      nameEn: row.nameEn,
      nameBn: row.nameBn,
      slug: row.slug,
      descriptionEn: row.descriptionEn,
      descriptionBn: row.descriptionBn,
      image: media(row.image),
      icon: media(row.icon),
      banner: media(row.banner),
      chipColor: row.chipColor,
      sort: row.sort,
      isActive: row.isActive,
      showOnHome: row.showOnHome,
      returnWindowDays: row.returnWindowDays,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      productCount,
      childCount,
    };
  }

  private assertCanSetHome(actor: StaffAuthContext, level: number) {
    if (!actor.permissions.has('categories.set_home')) {
      throw new ForbiddenException('Missing permission: categories.set_home');
    }
    if (level !== 1) {
      throw new BadRequestException('Only main categories can be shown on the home page');
    }
  }

  private async assertMedia(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    if (!wanted.length) return;
    const found = await this.prisma.media.count({ where: { id: { in: wanted } } });
    if (found !== wanted.length) throw new BadRequestException('Image not found');
  }

  private async uniqueSlug(base: string) {
    const taken = new Set(
      (
        await this.prisma.category.findMany({
          where: { slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((c) => c.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  private async nextSort(parentId: string | null) {
    const max = await this.prisma.category.aggregate({ _max: { sort: true }, where: { parentId } });
    return (max._max.sort ?? -1) + 1;
  }

  private async nextAttributeSort(categoryId: string) {
    const max = await this.prisma.categoryAttribute.aggregate({
      _max: { sort: true },
      where: { categoryId },
    });
    return (max._max.sort ?? -1) + 1;
  }

  private async maxLevelUnder(db: Tx | PrismaService, path: string) {
    const agg = await db.category.aggregate({
      _max: { level: true },
      where: { path: { startsWith: path } },
    });
    return agg._max.level ?? 0;
  }

  /** Re-parents `cat` and rewrites path and level of its whole sub-tree in one statement. */
  private async relocate(tx: Tx, cat: Category, newParent: Category | null) {
    const newPath = `${newParent?.path ?? '/'}${cat.id}/`;
    const delta = (newParent?.level ?? 0) + 1 - cat.level;
    await tx.$executeRaw`
      UPDATE categories
      SET path = ${newPath}::text || substr(path, ${cat.path.length + 1}::int),
          level = level + ${delta}::int,
          updated_at = now()
      WHERE starts_with(path, ${cat.path}::text)`;
    await tx.category.update({ where: { id: cat.id }, data: { parentId: newParent?.id ?? null } });
  }

  /** An attribute key must be unique along any root-to-leaf chain. */
  private async assertKeyFree(cat: Category, key: string) {
    const clash = await this.prisma.categoryAttribute.findFirst({
      where: {
        key,
        OR: [
          { categoryId: { in: pathIds(cat.path) } },
          { category: { path: { startsWith: cat.path } } },
        ],
      },
      include: { category: { select: { nameEn: true } } },
    });
    if (clash) {
      throw new ConflictException(
        `Attribute key "${key}" is already used by "${clash.category.nameEn}"`,
      );
    }
  }

  /** When a sub-tree gets new ancestors, its attribute keys must not collide with theirs. */
  private async assertNoKeyClash(tx: Tx, subtreePath: string, newAncestorIds: string[]) {
    if (!newAncestorIds.length) return;
    const moved = await tx.categoryAttribute.findMany({
      where: { category: { path: { startsWith: subtreePath } } },
      select: { key: true },
    });
    if (!moved.length) return;
    const clash = await tx.categoryAttribute.findFirst({
      where: { categoryId: { in: newAncestorIds }, key: { in: moved.map((m) => m.key) } },
    });
    if (clash) {
      throw new ConflictException(
        `Attribute key "${clash.key}" would clash with an attribute of the new parent chain`,
      );
    }
  }
}
