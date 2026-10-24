import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { B2bBuckets } from './sr.dto';

const DAY_MS = 86_400_000;
const DHAKA_OFFSET_MS = 6 * 3_600_000;

interface Debit {
  at: Date;
  remaining: number;
  saleId: string | null;
  sr: { id: string; name: string } | null;
}

const emptyBuckets = (): B2bBuckets => ({ d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 });

function bucketOf(days: number): keyof B2bBuckets {
  if (days <= 30) return 'd0_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90plus';
}

/** Dues ageing per shop (R16): who owes what, and for how long. */
@Injectable()
export class B2bDuesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Unpaid balance by age of the sale due it belongs to. Everything that reduces a due
   * (confirmed collections, negative adjustments, reversals without a matching sale due) is
   * applied oldest-first (FIFO); a reversal cancels its own sale's due. Shops whose net due is
   * not positive are left out. `asOf` is a Dhaka calendar date (end of day); default is now.
   */
  async dues(asOfDate?: string) {
    const asOf = asOfDate ? endOfDhakaDay(asOfDate) : new Date();
    const rows = await this.prisma.b2bLedger.findMany({
      where: {
        OR: [
          { type: { not: 'collection' }, at: { lte: asOf } },
          { type: 'collection', confirmedAt: { not: null, lte: asOf } },
        ],
      },
      orderBy: { id: 'asc' },
      select: {
        b2bShopId: true,
        type: true,
        amountP: true,
        at: true,
        confirmedAt: true,
        srSaleId: true,
        sale: { select: { sr: { select: { id: true, name: true } } } },
      },
    });

    const byShop = new Map<
      string,
      { debits: Debit[]; credit: number; lastCollectionAt: Date | null }
    >();
    for (const r of rows) {
      let s = byShop.get(r.b2bShopId);
      if (!s) {
        s = { debits: [], credit: 0, lastCollectionAt: null };
        byShop.set(r.b2bShopId, s);
      }
      if (r.type === 'sale_due' || (r.type === 'adjustment' && r.amountP > 0)) {
        s.debits.push({
          at: r.at,
          remaining: r.amountP,
          saleId: r.srSaleId,
          sr: r.sale?.sr ?? null,
        });
        continue;
      }
      let credit = -r.amountP;
      if (r.type === 'collection' && r.confirmedAt) {
        if (!s.lastCollectionAt || r.confirmedAt > s.lastCollectionAt)
          s.lastCollectionAt = r.confirmedAt;
      }
      if (r.type === 'reversal' && r.srSaleId) {
        const own = s.debits.find((d) => d.saleId === r.srSaleId && d.remaining > 0);
        if (own) {
          const used = Math.min(own.remaining, credit);
          own.remaining -= used;
          credit -= used;
        }
      }
      s.credit += credit;
    }

    const shops = await this.prisma.b2bShop.findMany({
      where: { id: { in: [...byShop.keys()] } },
      select: { id: true, name: true, phone: true, area: true },
    });
    const shopById = new Map(shops.map((s) => [s.id, s]));

    const totals = { ...emptyBuckets(), dueP: 0 };
    const items = [];
    for (const [shopId, s] of byShop) {
      let credit = s.credit;
      const buckets = emptyBuckets();
      const srs = new Map<string, { id: string; name: string }>();
      let dueP = 0;
      for (const d of [...s.debits].sort((a, b) => a.at.getTime() - b.at.getTime())) {
        const used = Math.min(d.remaining, Math.max(credit, 0));
        credit -= used;
        const left = d.remaining - used;
        if (left <= 0) continue;
        buckets[bucketOf(Math.floor((asOf.getTime() - d.at.getTime()) / DAY_MS))] += left;
        dueP += left;
        if (d.sr) srs.set(d.sr.id, d.sr);
      }
      const shop = shopById.get(shopId);
      if (dueP <= 0 || !shop) continue;
      totals.dueP += dueP;
      for (const k of Object.keys(buckets) as (keyof B2bBuckets)[]) totals[k] += buckets[k];
      items.push({
        shop,
        dueP,
        buckets,
        lastCollectionAt: s.lastCollectionAt?.toISOString() ?? null,
        srs: [...srs.values()],
      });
    }
    items.sort((a, b) => b.dueP - a.dueP || a.shop.name.localeCompare(b.shop.name));
    return { asOf: asOf.toISOString(), totals, items };
  }
}

function endOfDhakaDay(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1) - DHAKA_OFFSET_MS - 1);
}
