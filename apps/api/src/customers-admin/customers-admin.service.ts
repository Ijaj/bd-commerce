import { HttpStatus, Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '../generated/prisma/client';
import { itemCountOf } from '../orders-admin/order-lookup';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CustomerAdminDetailDto,
  CustomerAdminListDto,
  CustomerAdminListQueryDto,
  CustomerAdminNoteListDto,
  CustomerAdminOrderListDto,
} from './customers-admin.dto';
import { CustomerAdminError } from './customers-admin.errors';

/** Orders that do not count towards a customer's totals. */
const DEAD = ['cancelled', 'failed'] as const;

export const customerNotFound = () =>
  new CustomerAdminError(HttpStatus.NOT_FOUND, 'CUSTOMER_NOT_FOUND', 'Customer not found.');

@Injectable()
export class CustomersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async totals(ids: string[]) {
    const g = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, status: { notIn: [...DEAD] } },
      _count: { _all: true },
      _sum: { grandTotalP: true },
      _max: { placedAt: true },
    });
    return new Map(g.map((r) => [r.customerId, r]));
  }

  private rowOf(c: Customer, t: Awaited<ReturnType<CustomersAdminService['totals']>>) {
    const s = t.get(c.id);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      lang: c.lang,
      createdAt: c.createdAt.toISOString(),
      lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
      blocked: c.disabledAt !== null,
      orderCount: s?._count._all ?? 0,
      spentP: s?._sum.grandTotalP ?? 0,
      lastOrderAt: s?._max.placedAt?.toISOString() ?? null,
    };
  }

  async list(q: CustomerAdminListQueryDto): Promise<CustomerAdminListDto> {
    const needle = q.q?.trim();
    const digits = needle?.replace(/\D/g, '') ?? '';
    const phoneNeedles = new Set<string>();
    if (digits.length >= 3) phoneNeedles.add(digits);
    // +8801712… / 8801712… match the stored 01712… form.
    if (digits.startsWith('880') && digits.length > 5) phoneNeedles.add(`0${digits.slice(3)}`);
    const and: Prisma.CustomerWhereInput[] = [];
    if (needle) {
      and.push({
        OR: [
          { name: { contains: needle, mode: 'insensitive' } },
          { email: { contains: needle, mode: 'insensitive' } },
          ...[...phoneNeedles].map((p) => ({ phone: { contains: p } })),
        ],
      });
    }
    if (q.blocked === '1') and.push({ disabledAt: { not: null } });
    if (q.blocked === '0') and.push({ disabledAt: null });
    const live = { status: { notIn: [...DEAD] } };
    if (q.hasOrders === '1') and.push({ orders: { some: live } });
    if (q.hasOrders === '0') and.push({ orders: { none: live } });
    const where: Prisma.CustomerWhereInput = and.length ? { AND: and } : {};
    const [list, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    const t = await this.totals(list.map((c) => c.id));
    return { items: list.map((c) => this.rowOf(c, t)), total };
  }

  async detail(id: string): Promise<CustomerAdminDetailDto> {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          include: { upazila: true, district: true, area: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!c) throw customerNotFound();
    const [t, cancelledCount, blocker] = await Promise.all([
      this.totals([id]),
      this.prisma.order.count({ where: { customerId: id, status: 'cancelled' } }),
      c.blockedByStaffId
        ? this.prisma.staff.findUnique({
            where: { id: c.blockedByStaffId },
            select: { id: true, name: true },
          })
        : null,
    ]);
    return {
      ...this.rowOf(c, t),
      phoneVerifiedAt: c.phoneVerifiedAt?.toISOString() ?? null,
      emailVerifiedAt: c.emailVerifiedAt?.toISOString() ?? null,
      isFlagged: c.isFlagged,
      blockedAt: c.disabledAt?.toISOString() ?? null,
      blockedReason: c.blockedReason,
      blockedBy: blocker,
      cancelledCount,
      addresses: c.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        name: a.name,
        phone: a.phone,
        placeText: [a.area?.nameEn, a.upazila.nameEn, a.district.nameEn].filter(Boolean).join(', '),
        line: a.line,
        landmark: a.landmark,
        isDefault: a.isDefault,
      })),
    };
  }

  private async assertExists(id: string) {
    const c = await this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw customerNotFound();
  }

  async orders(
    id: string,
    q: { page: number; pageSize: number },
  ): Promise<CustomerAdminOrderListDto> {
    await this.assertExists(id);
    const where = { customerId: id };
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          orderNo: true,
          placedAt: true,
          status: true,
          paymentStatus: true,
          grandTotalP: true,
          items: { select: { qty: true, qtyCancelled: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: list.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        placedAt: o.placedAt.toISOString(),
        status: o.status,
        paymentStatus: o.paymentStatus,
        grandTotalP: o.grandTotalP,
        itemCount: itemCountOf(o.status, o.items),
      })),
      total,
    };
  }

  async notes(id: string): Promise<CustomerAdminNoteListDto> {
    await this.assertExists(id);
    const list = await this.prisma.customerNote.findMany({
      where: { customerId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: [...new Set(list.map((n) => n.staffId))] } },
      select: { id: true, name: true },
    });
    const byId = new Map(staff.map((s) => [s.id, s]));
    return {
      items: list.map((n) => ({
        id: n.id,
        staff: byId.get(n.staffId) ?? null,
        body: n.body,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  /** Append-only: there is no edit or delete. */
  async addNote(id: string, staff: { id: string; name: string }, body: string) {
    await this.assertExists(id);
    const n = await this.prisma.customerNote.create({
      data: { customerId: id, staffId: staff.id, body },
    });
    return {
      id: n.id,
      staff: { id: staff.id, name: staff.name },
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    };
  }

  async block(id: string, staffId: string, reason: string) {
    await this.assertExists(id);
    const done = await this.prisma.$transaction(async (tx) => {
      const r = await tx.customer.updateMany({
        where: { id, disabledAt: null },
        data: { disabledAt: new Date(), blockedReason: reason, blockedByStaffId: staffId },
      });
      if (r.count === 0) return false;
      await tx.customerSession.deleteMany({ where: { customerId: id } });
      return true;
    });
    if (!done) {
      throw new CustomerAdminError(
        HttpStatus.CONFLICT,
        'CUSTOMER_ALREADY_BLOCKED',
        'This customer is already blocked.',
      );
    }
    return this.detail(id);
  }

  async unblock(id: string) {
    await this.assertExists(id);
    const r = await this.prisma.customer.updateMany({
      where: { id, disabledAt: { not: null } },
      data: { disabledAt: null, blockedReason: null, blockedByStaffId: null },
    });
    if (r.count === 0) {
      throw new CustomerAdminError(
        HttpStatus.CONFLICT,
        'CUSTOMER_NOT_BLOCKED',
        'This customer is not blocked.',
      );
    }
    return this.detail(id);
  }
}
