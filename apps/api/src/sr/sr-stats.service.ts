import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { SrCommissionView, SrUpdateProfileDto } from './sr.dto';
import { commissionOf, monthKey, monthRange, srError } from './sr.util';

export interface MonthStats {
  month: string;
  targetP: number;
  soldP: number;
  collectedP: number;
  commissionP: number;
  dueOutstandingP: number;
  pendingCollectionP: number;
}

type CommissionRow = {
  id: string;
  month: string;
  baseP: number;
  commissionBp: number;
  amountP: number;
  status: string;
  paidAt: Date | null;
  sr: { id: string; name: string };
};

function toCommissionView(c: CommissionRow): SrCommissionView {
  return {
    id: c.id,
    sr: c.sr,
    month: c.month,
    baseP: c.baseP,
    commissionBp: c.commissionBp,
    amountP: c.amountP,
    status: c.status as SrCommissionView['status'],
    paidAt: c.paidAt?.toISOString() ?? null,
  };
}

/** SR profiles, monthly numbers, targets and commissions (R18, Q120). */
@Injectable()
export class SrStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ---- profiles ----------------------------------------------------------

  /** Portal gate: only staff with an sr_profile act as SR. */
  async requireProfile(staffId: string) {
    const profile = await this.prisma.srProfile.findUnique({ where: { staffId } });
    if (!profile) throw new ForbiddenException('No SR profile for this account');
    return profile;
  }

  async effectiveBp(profileBp: number | null): Promise<number> {
    return profileBp ?? (await this.settings.get('sr_default_commission_bp'));
  }

  async listProfiles() {
    const [rows, defaultBp] = await Promise.all([
      this.prisma.srProfile.findMany({
        include: { staff: true },
        orderBy: { staff: { name: 'asc' } },
      }),
      this.settings.get('sr_default_commission_bp'),
    ]);
    return rows.map((p) => this.profileView(p, defaultBp));
  }

  async getProfile(staffId: string) {
    const [p, defaultBp] = await Promise.all([
      this.prisma.srProfile.findUnique({ where: { staffId }, include: { staff: true } }),
      this.settings.get('sr_default_commission_bp'),
    ]);
    if (!p) throw new NotFoundException('SR profile not found');
    return this.profileView(p, defaultBp);
  }

  /** Creating the profile is what makes a staff member an SR. */
  async putProfile(staffId: string, dto: SrUpdateProfileDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    const data = {
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.commissionBp !== undefined && { commissionBp: dto.commissionBp }),
    };
    await this.prisma.srProfile.upsert({
      where: { staffId },
      create: { staffId, ...data },
      update: data,
    });
    return this.getProfile(staffId);
  }

  private profileView(
    p: {
      staffId: string;
      area: string | null;
      commissionBp: number | null;
      staff: { name: string; email: string; disabledAt: Date | null };
    },
    defaultBp: number,
  ) {
    return {
      staffId: p.staffId,
      name: p.staff.name,
      email: p.staff.email,
      disabled: p.staff.disabledAt !== null,
      area: p.area,
      commissionBp: p.commissionBp,
      effectiveCommissionBp: p.commissionBp ?? defaultBp,
    };
  }

  // ---- numbers -----------------------------------------------------------

  async portalMe(staffId: string, name: string) {
    const profile = await this.requireProfile(staffId);
    const bp = await this.effectiveBp(profile.commissionBp);
    const month = await this.monthStats(staffId, monthKey(new Date()), bp);
    return {
      staff: { id: staffId, name },
      profile: { area: profile.area, commissionBp: bp },
      month,
    };
  }

  async summary(month: string) {
    const defaultBp = await this.settings.get('sr_default_commission_bp');
    const profiles = await this.prisma.srProfile.findMany({
      include: { staff: { select: { name: true } } },
      orderBy: { staff: { name: 'asc' } },
    });
    const items = [];
    for (const p of profiles) {
      const { month: _m, ...stats } = await this.monthStats(
        p.staffId,
        month,
        p.commissionBp ?? defaultBp,
      );
      items.push({ srStaffId: p.staffId, name: p.staff.name, ...stats });
    }
    return { month, items };
  }

  private async monthStats(srStaffId: string, month: string, bp: number): Promise<MonthStats> {
    const { start, end } = monthRange(month);
    const [target, sold, collected, owed, pending] = await Promise.all([
      this.prisma.srTarget.findUnique({ where: { srStaffId_month: { srStaffId, month } } }),
      this.prisma.srSale.aggregate({
        where: {
          srStaffId,
          status: { in: ['approved', 'delivered'] },
          approvedAt: { gte: start, lt: end },
        },
        _sum: { totalP: true, paidAtSaleP: true },
      }),
      this.prisma.b2bLedger.aggregate({
        where: {
          recordedById: srStaffId,
          type: 'collection',
          confirmedAt: { gte: start, lt: end },
        },
        _sum: { amountP: true },
      }),
      this.prisma.$queryRaw<{ due: bigint }[]>`
        SELECT coalesce(sum(l.amount_p), 0) AS due
        FROM b2b_ledger l
        LEFT JOIN sr_sales s ON s.id = l.sr_sale_id
        WHERE (l.type IN ('sale_due', 'reversal') AND s.sr_staff_id = ${srStaffId}::uuid)
           OR (l.type = 'collection' AND l.recorded_by_id = ${srStaffId}::uuid AND l.confirmed_at IS NOT NULL)`,
      this.prisma.b2bLedger.aggregate({
        where: { recordedById: srStaffId, type: 'collection', confirmedAt: null, rejectedAt: null },
        _sum: { amountP: true },
      }),
    ]);
    const collectedP = (sold._sum.paidAtSaleP ?? 0) + -(collected._sum.amountP ?? 0);
    return {
      month,
      targetP: target?.targetP ?? 0,
      soldP: sold._sum.totalP ?? 0,
      collectedP,
      commissionP: commissionOf(collectedP, bp),
      dueOutstandingP: Math.max(0, Number(owed[0]?.due ?? 0)),
      pendingCollectionP: -(pending._sum.amountP ?? 0),
    };
  }

  // ---- targets -----------------------------------------------------------

  async targets(month: string) {
    const [profiles, rows] = await Promise.all([
      this.prisma.srProfile.findMany({
        include: { staff: { select: { name: true } } },
        orderBy: { staff: { name: 'asc' } },
      }),
      this.prisma.srTarget.findMany({ where: { month } }),
    ]);
    const byStaff = new Map(rows.map((t) => [t.srStaffId, t.targetP]));
    return {
      month,
      items: profiles.map((p) => ({
        srStaffId: p.staffId,
        name: p.staff.name,
        targetP: byStaff.get(p.staffId) ?? null,
      })),
    };
  }

  async setTargets(month: string, targets: { srStaffId: string; targetP: number }[]) {
    monthRange(month);
    const ids = [...new Set(targets.map((t) => t.srStaffId))];
    const known = await this.prisma.srProfile.count({ where: { staffId: { in: ids } } });
    if (known !== ids.length) throw new NotFoundException('Some staff have no SR profile');
    await this.prisma.$transaction(async (tx) => {
      for (const t of targets) {
        await tx.srTarget.upsert({
          where: { srStaffId_month: { srStaffId: t.srStaffId, month } },
          create: { srStaffId: t.srStaffId, month, targetP: t.targetP },
          update: { targetP: t.targetP },
        });
      }
    });
    return this.targets(month);
  }

  // ---- commissions -------------------------------------------------------

  async listCommissions(month: string) {
    monthRange(month);
    const rows = await this.prisma.srCommission.findMany({
      where: { month },
      include: { sr: { select: { id: true, name: true } } },
      orderBy: { sr: { name: 'asc' } },
    });
    return { month, items: rows.map(toCommissionView) };
  }

  /**
   * Base = payment at sale of sales approved in the month + confirmed collections in the month
   * (Q120). Safe to re-run: pending rows are recalculated, approved/paid rows are left alone.
   */
  async computeCommissions(month: string) {
    const { start, end } = monthRange(month);
    const [sales, collections, existing, profiles, defaultBp] = await Promise.all([
      this.prisma.srSale.groupBy({
        by: ['srStaffId'],
        where: { status: { in: ['approved', 'delivered'] }, approvedAt: { gte: start, lt: end } },
        _sum: { paidAtSaleP: true },
      }),
      this.prisma.b2bLedger.groupBy({
        by: ['recordedById'],
        where: { type: 'collection', confirmedAt: { gte: start, lt: end } },
        _sum: { amountP: true },
      }),
      this.prisma.srCommission.findMany({ where: { month } }),
      this.prisma.srProfile.findMany(),
      this.settings.get('sr_default_commission_bp'),
    ]);
    const base = new Map<string, number>();
    for (const s of sales) base.set(s.srStaffId, s._sum.paidAtSaleP ?? 0);
    for (const c of collections) {
      base.set(c.recordedById, (base.get(c.recordedById) ?? 0) - (c._sum.amountP ?? 0));
    }
    const bpOf = new Map(profiles.map((p) => [p.staffId, p.commissionBp ?? defaultBp]));
    const locked = new Set(existing.filter((e) => e.status !== 'pending').map((e) => e.srStaffId));
    const targets = new Set([...base.keys(), ...existing.map((e) => e.srStaffId)]);

    let skipped = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const srStaffId of targets) {
        const bp = bpOf.get(srStaffId);
        if (bp === undefined) continue; // not (or no longer) an SR
        if (locked.has(srStaffId)) {
          skipped += 1;
          continue;
        }
        const baseP = base.get(srStaffId) ?? 0;
        const data = { baseP, commissionBp: bp, amountP: commissionOf(baseP, bp) };
        await tx.srCommission.upsert({
          where: { srStaffId_month: { srStaffId, month } },
          create: { srStaffId, month, ...data },
          update: data,
        });
      }
    });
    return { ...(await this.listCommissions(month)), skipped };
  }

  async approveCommission(id: string): Promise<SrCommissionView> {
    return this.transition(
      id,
      'pending',
      { status: 'approved' },
      'Only pending commissions can be approved',
    );
  }

  async markCommissionPaid(id: string): Promise<SrCommissionView> {
    return this.transition(
      id,
      'approved',
      { status: 'paid', paidAt: new Date() },
      'Approve the commission before paying it',
    );
  }

  private async transition(
    id: string,
    from: string,
    data: { status: string; paidAt?: Date },
    message: string,
  ): Promise<SrCommissionView> {
    const done = await this.prisma.srCommission.updateMany({ where: { id, status: from }, data });
    if (done.count === 0) {
      const found = await this.prisma.srCommission.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!found) throw new NotFoundException('Commission not found');
      throw srError(ConflictException, 'INVALID_STATE', message);
    }
    const row = await this.prisma.srCommission.findUniqueOrThrow({
      where: { id },
      include: { sr: { select: { id: true, name: true } } },
    });
    return toCommissionView(row);
  }
}
