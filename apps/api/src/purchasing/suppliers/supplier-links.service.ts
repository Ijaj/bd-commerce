import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SupplierLinkListQueryDto, SupplierLinkUpsertDto } from './suppliers.dto';
import { SupplierError } from './suppliers.errors';
import { SuppliersService } from './suppliers.service';

const linkInclude = {
  variant: {
    include: {
      product: { select: { id: true, titleEn: true, fulfillment: true } },
      optionValue1: { select: { valueEn: true, valueBn: true } },
      optionValue2: { select: { valueEn: true, valueBn: true } },
    },
  },
} satisfies Prisma.VariantSupplierInclude;

type LinkRow = Prisma.VariantSupplierGetPayload<{ include: typeof linkInclude }>;

function toView(l: LinkRow) {
  const v = l.variant;
  return {
    variantId: v.id,
    productId: v.product.id,
    productTitleEn: v.product.titleEn,
    sku: v.sku,
    options: [v.optionValue1, v.optionValue2]
      .filter((o): o is NonNullable<typeof o> => o !== null)
      .map((o) => ({ en: o.valueEn, bn: o.valueBn })),
    supplierSku: l.supplierSku,
    costP: l.costP,
    leadTimeDays: l.leadTimeDays,
    isDefault: l.isDefault,
    variantCostP: v.costP,
    fulfillment: v.product.fulfillment,
  };
}

@Injectable()
export class SupplierLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
  ) {}

  async list(supplierId: string, q: SupplierLinkListQueryDto) {
    await this.suppliers.assertExists(supplierId);
    const where: Prisma.VariantSupplierWhereInput = { supplierId };
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      where.OR = [
        { supplierSku: contains },
        { variant: { sku: contains } },
        { variant: { product: { titleEn: contains } } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.variantSupplier.count({ where }),
      this.prisma.variantSupplier.findMany({
        where,
        include: linkInclude,
        orderBy: [{ variant: { product: { titleEn: 'asc' } } }, { variant: { sku: 'asc' } }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { items: rows.map(toView), total };
  }

  async upsert(supplierId: string, variantId: string, body: SupplierLinkUpsertDto) {
    await this.suppliers.assertExists(supplierId);
    await this.prisma.$transaction(async (tx) => {
      const variant = await tx.variant.findUnique({
        where: { id: variantId },
        select: { id: true },
      });
      if (!variant) {
        throw new SupplierError(HttpStatus.NOT_FOUND, 'VARIANT_NOT_FOUND', 'Variant not found');
      }
      // Serialise per variant so two default switches cannot both win.
      await tx.$executeRaw`SELECT id FROM variants WHERE id = ${variantId}::uuid FOR UPDATE`;
      const existing = await tx.variantSupplier.findUnique({
        where: { variantId_supplierId: { variantId, supplierId } },
        select: { id: true },
      });
      const others = await tx.variantSupplier.count({
        where: { variantId, supplierId: { not: supplierId } },
      });
      const isDefault = body.isDefault ?? (existing ? undefined : others === 0);
      if (isDefault) {
        await tx.variantSupplier.updateMany({
          where: { variantId, supplierId: { not: supplierId } },
          data: { isDefault: false },
        });
      }
      const data = {
        supplierSku: body.supplierSku === '' ? null : body.supplierSku,
        costP: body.costP,
        leadTimeDays: body.leadTimeDays,
        isDefault,
      };
      if (existing) await tx.variantSupplier.update({ where: { id: existing.id }, data });
      else await tx.variantSupplier.create({ data: { ...data, supplierId, variantId } });
    });
    return this.one(supplierId, variantId);
  }

  async remove(supplierId: string, variantId: string) {
    await this.suppliers.assertExists(supplierId);
    const { count } = await this.prisma.variantSupplier.deleteMany({
      where: { supplierId, variantId },
    });
    if (count === 0) {
      throw new SupplierError(HttpStatus.NOT_FOUND, 'LINK_NOT_FOUND', 'Link not found');
    }
  }

  private async one(supplierId: string, variantId: string) {
    const row = await this.prisma.variantSupplier.findUniqueOrThrow({
      where: { variantId_supplierId: { variantId, supplierId } },
      include: linkInclude,
    });
    return toView(row);
  }
}
