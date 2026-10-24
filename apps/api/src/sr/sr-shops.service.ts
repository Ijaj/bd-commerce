import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { B2bLedgerService } from './b2b-ledger.service';
import type {
  B2bShopsQueryDto,
  B2bUpdateShopDto,
  SrCreateShopDto,
  SrShopsQueryDto,
  SrShopView,
} from './sr.dto';

const shopInclude = {
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.B2bShopInclude;
type ShopRow = Prisma.B2bShopGetPayload<{ include: typeof shopInclude }>;

export function toShopView(s: ShopRow): SrShopView {
  return {
    id: s.id,
    name: s.name,
    ownerName: s.ownerName,
    phone: s.phone,
    address: s.address,
    area: s.area,
    isNew: s.isNew,
    status: s.status === 'blocked' ? 'blocked' : 'active',
    dueBalanceP: s.dueBalanceP,
    notes: s.notes,
    createdBy: s.createdBy,
    createdAt: s.createdAt.toISOString(),
  };
}

function search(q: string | undefined): Prisma.B2bShopWhereInput {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { ownerName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { area: { contains: q, mode: 'insensitive' } },
    ],
  };
}

@Injectable()
export class SrShopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: B2bLedgerService,
  ) {}

  /** Shops are shared: every SR sees and can sell to every shop (R14, Q119). */
  async portalList(q: SrShopsQueryDto) {
    return this.list(search(q.q), q.page, q.pageSize);
  }

  async create(srStaffId: string, dto: SrCreateShopDto): Promise<SrShopView> {
    const shop = await this.prisma.b2bShop.create({
      data: {
        name: dto.name,
        ownerName: dto.ownerName ?? null,
        phone: dto.phone,
        address: dto.address,
        area: dto.area ?? null,
        createdById: srStaffId,
        isNew: true,
      },
      include: shopInclude,
    });
    return toShopView(shop);
  }

  async portalDetail(id: string, srStaffId: string) {
    const shop = await this.get(id);
    return { ...shop, ledger: await this.ledger.ownEntries(id, srStaffId) };
  }

  async adminList(q: B2bShopsQueryDto) {
    const where: Prisma.B2bShopWhereInput = { ...search(q.q) };
    if (q.status) where.status = q.status;
    if (q.isNew) where.isNew = q.isNew === 'true';
    if (q.hasDue) where.dueBalanceP = q.hasDue === 'true' ? { gt: 0 } : { lte: 0 };
    return this.list(where, q.page, q.pageSize);
  }

  async get(id: string): Promise<SrShopView> {
    const shop = await this.prisma.b2bShop.findUnique({ where: { id }, include: shopInclude });
    if (!shop) throw new NotFoundException('Shop not found');
    return toShopView(shop);
  }

  async update(id: string, dto: B2bUpdateShopDto): Promise<SrShopView> {
    await this.get(id);
    const shop = await this.prisma.b2bShop.update({
      where: { id },
      data: dto,
      include: shopInclude,
    });
    return toShopView(shop);
  }

  private async list(where: Prisma.B2bShopWhereInput, page: number, pageSize: number) {
    const [total, rows] = await Promise.all([
      this.prisma.b2bShop.count({ where }),
      this.prisma.b2bShop.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: shopInclude,
      }),
    ]);
    return { items: rows.map(toShopView), total, page, pageSize };
  }
}
