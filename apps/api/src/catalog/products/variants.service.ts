import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PermissionKey } from '../../auth/permissions';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { VariantsPayload } from './products.dto';
import { rethrowReferenced, rethrowUnique } from './slug';

type Tx = Prisma.TransactionClient;
type Perms = Set<PermissionKey>;

const sameDate = (stored: Date | null, input: string | null | undefined) =>
  (stored?.getTime() ?? null) === (input ? new Date(input).getTime() : null);

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Replaces options + variants of a product with the desired state in one transaction. */
  async set(perms: Perms, productId: string, payload: VariantsPayload) {
    await this.prisma
      .$transaction((tx) => this.apply(tx, perms, productId, payload))
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
          return rethrowReferenced(e, 'An option value or variant is still referenced');
        }
        return rethrowUnique(e, 'SKU or option combination already exists');
      });
  }

  async apply(tx: Tx, perms: Perms, productId: string, payload: VariantsPayload) {
    // Serialise concurrent edits of the same product's variants.
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        options: { include: { values: true } },
        variants: { include: { inventory: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const { options, variants } = payload;
    const bad = (m: string) => new BadRequestException(m);

    // ---- options -----------------------------------------------------------------------
    const positions = options.map((o) => o.position).sort();
    if (
      options.length > 0 &&
      !(positions[0] === 1 && (positions.length === 1 || positions[1] === 2))
    ) {
      throw bad('Options must use positions 1 (and 2)');
    }
    const ordered = [...options].sort((a, b) => a.position - b.position);
    const lower = (s: string) => s.trim().toLowerCase();
    for (const opt of ordered) {
      const existing = product.options.find((o) => o.position === opt.position);
      const known = new Set(existing?.values.map((v) => v.id));
      const seenEn = new Set<string>();
      const seenBn = new Set<string>();
      const seenIds = new Set<string>();
      for (const v of opt.values) {
        if (v.id && (!known.has(v.id) || seenIds.has(v.id))) {
          throw bad(`Unknown or repeated option value id in "${opt.nameEn}"`);
        }
        if (v.id) seenIds.add(v.id);
        if (seenEn.has(lower(v.valueEn)))
          throw bad(`Duplicate value "${v.valueEn}" in "${opt.nameEn}"`);
        seenEn.add(lower(v.valueEn));
        if (v.valueBn) {
          if (seenBn.has(lower(v.valueBn)))
            throw bad(`Duplicate value "${v.valueBn}" in "${opt.nameEn}"`);
          seenBn.add(lower(v.valueBn));
        }
      }
    }

    // ---- variants (pure validation) ---------------------------------------------------------
    if (ordered.length === 0) {
      if (variants.length !== 1) throw bad('A product without options has exactly one variant');
      if (variants[0]?.optionValueRefs.length) throw bad('optionValueRefs needs options');
    }
    const existingById = new Map(product.variants.map((v) => [v.id, v]));
    const seenVariantIds = new Set<string>();
    const seenSkus = new Set<string>();
    const seenCombos = new Set<string>();
    /** Per variant: index of the chosen value in each option. */
    const comboIdx: number[][] = [];
    for (const v of variants) {
      if (v.id) {
        if (!existingById.has(v.id)) throw bad(`Variant ${v.id} does not belong to this product`);
        if (seenVariantIds.has(v.id)) throw bad(`Variant ${v.id} listed twice`);
        seenVariantIds.add(v.id);
      }
      if (seenSkus.has(v.sku)) throw new ConflictException(`SKU "${v.sku}" is used twice`);
      seenSkus.add(v.sku);

      if (ordered.length > 0) {
        if (v.optionValueRefs.length !== ordered.length) {
          throw bad(`Variant "${v.sku}" needs ${ordered.length} option value(s)`);
        }
        const idx = v.optionValueRefs.map((ref, i) => {
          const values = ordered[i]?.values ?? [];
          const at = typeof ref === 'number' ? ref : values.findIndex((x) => x.id === ref);
          if (at < 0 || at >= values.length)
            throw bad(`Variant "${v.sku}" has an invalid option value`);
          return at;
        });
        const key = idx.join('/');
        if (seenCombos.has(key)) throw bad(`Variant "${v.sku}" repeats an option combination`);
        seenCombos.add(key);
        comboIdx.push(idx);
      } else {
        comboIdx.push([]);
      }

      if (v.salePriceP != null && v.salePriceP >= v.priceP) {
        throw bad(`Variant "${v.sku}": sale price must be below the price`);
      }
      if (v.compareAtP != null && v.compareAtP <= v.priceP) {
        throw bad(`Variant "${v.sku}": compare-at price must be above the price`);
      }
      if ((v.saleStartsAt || v.saleEndsAt) && v.salePriceP == null) {
        throw bad(`Variant "${v.sku}": sale dates need a sale price`);
      }
      if (v.saleStartsAt && v.saleEndsAt && new Date(v.saleStartsAt) >= new Date(v.saleEndsAt)) {
        throw bad(`Variant "${v.sku}": sale must start before it ends`);
      }
    }

    // ---- permissions -----------------------------------------------------------------------
    for (const v of variants) {
      const old = v.id ? existingById.get(v.id) : undefined;
      const priceChanged = old
        ? v.priceP !== old.priceP ||
          (v.compareAtP ?? null) !== old.compareAtP ||
          (v.salePriceP ?? null) !== old.salePriceP ||
          !sameDate(old.saleStartsAt, v.saleStartsAt) ||
          !sameDate(old.saleEndsAt, v.saleEndsAt)
        : v.priceP !== 0 ||
          v.compareAtP != null ||
          v.salePriceP != null ||
          !!v.saleStartsAt ||
          !!v.saleEndsAt;
      if (priceChanged && !perms.has('products.edit_price')) {
        throw new ForbiddenException('Missing permission: products.edit_price');
      }
      if (
        v.costP !== undefined &&
        v.costP !== (old?.costP ?? null) &&
        !perms.has('products.view_cost')
      ) {
        throw new ForbiddenException('Missing permission: products.view_cost');
      }
    }

    // ---- write: variants no longer listed ----------------------------------------------------
    for (const old of product.variants) {
      if (seenVariantIds.has(old.id)) continue;
      const moved = await tx.stockMovement.count({
        where: { variantId: old.id, OR: [{ qtyDelta: { not: 0 } }, { reservedDelta: { not: 0 } }] },
      });
      if (moved === 0) {
        await tx.variant.delete({ where: { id: old.id } });
      } else {
        // Variants with stock history (and, later, orders) are retired instead of deleted.
        await tx.variant.update({
          where: { id: old.id },
          data: { isActive: false, optionValue1Id: null, optionValue2Id: null },
        });
      }
    }

    // SKUs must be unique across the whole DB (retired variants keep theirs).
    const clashes = await tx.variant.findMany({
      where: { sku: { in: variants.map((v) => v.sku) } },
      select: { id: true, sku: true },
    });
    for (const c of clashes) {
      // Variants being updated in this request vacate their old sku below, so only others clash.
      if (!seenVariantIds.has(c.id)) {
        throw new ConflictException(`SKU "${c.sku}" is already used by another variant`);
      }
    }

    // Park changing skus / combos so swaps cannot trip the unique indexes mid-way.
    for (const v of variants) {
      if (v.id && existingById.get(v.id)?.sku !== v.sku) {
        await tx.variant.update({ where: { id: v.id }, data: { sku: `~${v.id}` } });
      }
    }
    for (const v of variants) {
      if (v.id) {
        await tx.variant.update({
          where: { id: v.id },
          data: { optionValue1Id: null, optionValue2Id: null },
        });
      }
    }

    // ---- write: options and values -----------------------------------------------------------
    const valueIds: string[][] = [];
    for (const old of product.options) {
      if (!ordered.some((o) => o.position === old.position)) {
        await tx.productOption.delete({ where: { id: old.id } });
      }
    }
    for (const opt of ordered) {
      const existing = product.options.find((o) => o.position === opt.position);
      const row = existing
        ? await tx.productOption.update({
            where: { id: existing.id },
            data: { nameEn: opt.nameEn, nameBn: opt.nameBn || null },
          })
        : await tx.productOption.create({
            data: {
              productId,
              position: opt.position,
              nameEn: opt.nameEn,
              nameBn: opt.nameBn || null,
            },
          });
      const keep = new Set(opt.values.flatMap((v) => (v.id ? [v.id] : [])));
      const drop = (existing?.values ?? []).filter((v) => !keep.has(v.id)).map((v) => v.id);
      if (drop.length) await tx.productOptionValue.deleteMany({ where: { id: { in: drop } } });
      const ids: string[] = [];
      for (const [sort, v] of opt.values.entries()) {
        const data = {
          valueEn: v.valueEn,
          valueBn: v.valueBn || null,
          swatchHex: v.swatchHex ?? null,
          sort,
        };
        if (v.id) {
          await tx.productOptionValue.update({ where: { id: v.id }, data });
          ids.push(v.id);
        } else {
          const created = await tx.productOptionValue.create({
            data: { ...data, optionId: row.id },
          });
          ids.push(created.id);
        }
      }
      valueIds.push(ids);
    }

    // ---- write: variants -------------------------------------------------------------------
    for (const [sort, v] of variants.entries()) {
      const idx = comboIdx[sort] ?? [];
      const data = {
        sku: v.sku,
        barcode: v.barcode || null,
        optionValue1Id: idx[0] === undefined ? null : (valueIds[0]?.[idx[0]] ?? null),
        optionValue2Id: idx[1] === undefined ? null : (valueIds[1]?.[idx[1]] ?? null),
        priceP: v.priceP,
        compareAtP: v.compareAtP ?? null,
        salePriceP: v.salePriceP ?? null,
        saleStartsAt: v.saleStartsAt ? new Date(v.saleStartsAt) : null,
        saleEndsAt: v.saleEndsAt ? new Date(v.saleEndsAt) : null,
        weightG: v.weightG ?? null,
        isActive: v.isActive,
        sort,
      };
      if (v.id) {
        await tx.variant.update({
          where: { id: v.id },
          data: { ...data, ...(v.costP !== undefined && { costP: v.costP }) },
        });
        if (v.lowStockThreshold !== undefined) {
          await tx.inventory.upsert({
            where: { variantId: v.id },
            create: { variantId: v.id, lowStockThreshold: v.lowStockThreshold },
            update: { lowStockThreshold: v.lowStockThreshold },
          });
        }
      } else {
        // Zero stock needs no stock_movements row.
        await tx.variant.create({
          data: {
            ...data,
            productId,
            costP: v.costP ?? null,
            inventory: { create: { onHand: 0, lowStockThreshold: v.lowStockThreshold ?? null } },
          },
        });
      }
    }

    await tx.product.update({
      where: { id: productId },
      data: { hasVariants: ordered.length > 0 },
    });
  }
}
