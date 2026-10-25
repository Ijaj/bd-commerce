import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponError } from './coupons.errors';

const TZ = 'Asia/Dhaka';

/** `from`/`to` are calendar days in Dhaka time, both inclusive. */
function range(from: string | undefined, to: string | undefined) {
  const parts: Prisma.Sql[] = [];
  if (from)
    parts.push(Prisma.sql`AND r.created_at >= (${from}::date)::timestamp AT TIME ZONE ${TZ}`);
  if (to)
    parts.push(Prisma.sql`AND r.created_at < ((${to}::date) + 1)::timestamp AT TIME ZONE ${TZ}`);
  return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
}

@Injectable()
export class CouponReportService {
  constructor(private readonly prisma: PrismaService) {}

  async report(couponId: string, from?: string, to?: string) {
    const exists = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      select: { id: true },
    });
    if (!exists)
      throw new CouponError(HttpStatus.NOT_FOUND, 'COUPON_NOT_FOUND', 'Coupon not found.');
    const when = range(from, to);

    const [totals, daily, top] = await Promise.all([
      this.prisma.$queryRaw<
        {
          uses: bigint;
          customers: bigint;
          revenue: bigint | null;
          discount: bigint | null;
          reversed: bigint;
        }[]
      >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE r.status = 'applied') AS uses,
          COUNT(DISTINCT COALESCE(r.customer_id::text, 'p:' || r.phone, 'v:' || r.visitor_id))
            FILTER (WHERE r.status = 'applied') AS customers,
          SUM(o.grand_total_p) FILTER (WHERE r.status = 'applied') AS revenue,
          SUM(r.discount_p) FILTER (WHERE r.status = 'applied') AS discount,
          COUNT(*) FILTER (WHERE r.status = 'reversed') AS reversed
        FROM coupon_redemptions r JOIN orders o ON o.id = r.order_id
        WHERE r.coupon_id = ${couponId}::uuid ${when}`),
      this.prisma.$queryRaw<{ date: string; uses: bigint; discount: bigint }[]>(Prisma.sql`
        SELECT to_char((r.created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS date,
               COUNT(*) AS uses, SUM(r.discount_p) AS discount
        FROM coupon_redemptions r
        WHERE r.coupon_id = ${couponId}::uuid AND r.status = 'applied' ${when}
        GROUP BY 1 ORDER BY 1`),
      this.prisma.$queryRaw<
        { customer_id: string; name: string; uses: bigint; discount: bigint }[]
      >(Prisma.sql`
        SELECT r.customer_id, c.name, COUNT(*) AS uses, SUM(r.discount_p) AS discount
        FROM coupon_redemptions r JOIN customers c ON c.id = r.customer_id
        WHERE r.coupon_id = ${couponId}::uuid AND r.status = 'applied' ${when}
        GROUP BY r.customer_id, c.name
        ORDER BY uses DESC, discount DESC, c.name LIMIT 10`),
    ]);

    const t = totals[0];
    const uses = Number(t?.uses ?? 0);
    const revenue = Number(t?.revenue ?? 0);
    return {
      uses,
      uniqueCustomers: Number(t?.customers ?? 0),
      revenueP: revenue,
      discountGivenP: Number(t?.discount ?? 0),
      avgOrderP: uses > 0 ? Math.round(revenue / uses) : 0,
      reversed: Number(t?.reversed ?? 0),
      daily: daily.map((d) => ({
        date: d.date,
        uses: Number(d.uses),
        discountP: Number(d.discount),
      })),
      topCustomers: top.map((x) => ({
        customerId: x.customer_id,
        name: x.name,
        uses: Number(x.uses),
        discountP: Number(x.discount),
      })),
    };
  }
}
