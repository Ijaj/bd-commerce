import { HttpStatus, Injectable } from '@nestjs/common';
import { normalizePhone } from '../../customers/phone';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SupplierCreateDto, SupplierListQueryDto, SupplierUpdateDto } from './suppliers.dto';
import { SupplierError } from './suppliers.errors';

type SupplierModel = Prisma.SupplierGetPayload<object>;

const OPEN_PO = ['sent', 'partially_received'] as const;

export function supplierNotFound() {
  return new SupplierError(HttpStatus.NOT_FOUND, 'SUPPLIER_NOT_FOUND', 'Supplier not found');
}

function cleanPhone(phone: string | null | undefined): string | null | undefined {
  if (!phone) return phone === '' ? null : phone;
  const n = normalizePhone(phone);
  if (!n) {
    throw new SupplierError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'SUPPLIER_PHONE_INVALID',
      'Enter a Bangladesh mobile number like 01712345678',
    );
  }
  return n;
}

/** Empty string from a cleared input means "no value". */
const blank = (v: string | null | undefined) => (v === '' ? null : v);

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: SupplierListQueryDto) {
    const where: Prisma.SupplierWhereInput = {};
    if (q.active !== undefined) where.isActive = q.active;
    if (q.q) {
      const contains = { contains: q.q, mode: 'insensitive' as const };
      where.OR = [{ name: contains }, { phone: contains }, { email: contains }];
    }
    const [total, rows] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { _count: { select: { variants: true } } },
      }),
    ]);
    const stats = await this.stats(rows.map((r) => r.id));
    return {
      items: rows.map((r) => ({
        ...this.row(r),
        productCount: r._count.variants,
        ...(stats.get(r.id) ?? { openPoCount: 0, balanceP: 0 }),
      })),
      total,
    };
  }

  async detail(id: string) {
    const r = await this.prisma.supplier.findUnique({
      where: { id },
      include: { _count: { select: { variants: true } } },
    });
    if (!r) throw supplierNotFound();
    const stats = await this.stats([id]);
    return {
      ...this.row(r),
      productCount: r._count.variants,
      ...(stats.get(id) ?? { openPoCount: 0, balanceP: 0 }),
      address: r.address,
      pickupAddress: r.pickupAddress,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async create(body: SupplierCreateDto) {
    const phone = cleanPhone(body.phone);
    await this.assertNameFree(body.name);
    const created = await this.prisma.supplier.create({
      data: {
        name: body.name,
        contactName: body.contactName,
        phone: phone ?? null,
        email: body.email ?? null,
        address: body.address,
        pickupAddress: body.pickupAddress,
        shipMode: body.shipMode,
        paymentTerms: body.paymentTerms,
        notes: body.notes,
      },
    });
    return this.detail(created.id);
  }

  async update(id: string, body: SupplierUpdateDto) {
    const current = await this.prisma.supplier.findUnique({ where: { id } });
    if (!current) throw supplierNotFound();
    if (body.name !== undefined) await this.assertNameFree(body.name, id);
    const phone = cleanPhone(body.phone);
    await this.prisma.supplier.update({
      where: { id },
      data: {
        name: body.name,
        contactName: blank(body.contactName),
        phone,
        email: blank(body.email),
        address: blank(body.address),
        pickupAddress: blank(body.pickupAddress),
        shipMode: body.shipMode,
        paymentTerms: blank(body.paymentTerms),
        notes: blank(body.notes),
        isActive: body.isActive,
      },
    });
    return this.detail(id);
  }

  async assertExists(id: string) {
    const s = await this.prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!s) throw supplierNotFound();
  }

  /** Case-insensitive uniqueness is checked in code (no unique index; names are free text). */
  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.prisma.supplier.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new SupplierError(
        HttpStatus.CONFLICT,
        'SUPPLIER_NAME_TAKEN',
        'Another supplier already uses this name',
      );
    }
  }

  private row(r: SupplierModel) {
    return {
      id: r.id,
      name: r.name,
      contactName: r.contactName,
      phone: r.phone,
      email: r.email,
      shipMode: r.shipMode,
      paymentTerms: r.paymentTerms,
      isActive: r.isActive,
    };
  }

  /** Open PO count + ledger balance for a page of suppliers, two grouped queries. */
  private async stats(ids: string[]) {
    const out = new Map<string, { openPoCount: number; balanceP: number }>();
    if (ids.length === 0) return out;
    const [pos, sums] = await Promise.all([
      this.prisma.purchaseOrder.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: ids }, status: { in: [...OPEN_PO] } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ supplier_id: string; bal: bigint }[]>`
        SELECT supplier_id, sum(amount_p)::bigint AS bal FROM supplier_ledger
        WHERE supplier_id IN (${Prisma.join(ids.map((i) => Prisma.sql`${i}::uuid`))})
        GROUP BY supplier_id`,
    ]);
    for (const id of ids) out.set(id, { openPoCount: 0, balanceP: 0 });
    for (const p of pos) {
      const s = out.get(p.supplierId);
      if (s) s.openPoCount = p._count._all;
    }
    for (const s of sums) {
      const e = out.get(s.supplier_id);
      if (e) e.balanceP = Number(s.bal);
    }
    return out;
  }
}
