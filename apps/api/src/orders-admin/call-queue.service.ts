import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import type { StaffAuthContext } from '../auth/staff-auth.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrderCancelService } from './order-cancel.service';
import { resolveOrderId } from './order-lookup';
import type { OrdersAdminCallQueueQueryDto } from './orders-admin.dto';
import { OrdersAdminError } from './orders-admin.errors';
import { listInclude, toListItem } from './orders-admin.service';

/** Cancelled orders drop out of the pending list: nobody needs to call them any more. */
const PENDING: Prisma.OrderWhereInput = { callStatus: 'pending', status: { not: 'cancelled' } };

@Injectable()
export class CallQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cancel: OrderCancelService,
  ) {}

  async list(q: OrdersAdminCallQueueQueryDto) {
    const done = q.status === 'done';
    const where: Prisma.OrderWhereInput = done
      ? { callStatus: { in: ['confirmed', 'unreachable', 'cancelled'] } }
      : PENDING;
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: listInclude,
        orderBy: done ? [{ callAt: 'desc' }, { id: 'desc' }] : [{ placedAt: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { items: rows.map(toListItem), total, page: q.page, pageSize: q.pageSize };
  }

  async count() {
    return { pending: await this.prisma.order.count({ where: PENDING }) };
  }

  async outcome(
    ctx: StaffAuthContext,
    idOrNo: string,
    outcome: 'confirmed' | 'unreachable' | 'cancelled',
    note: string | undefined,
  ) {
    if (outcome === 'cancelled' && !ctx.permissions.has('orders.manage')) {
      throw new ForbiddenException('Missing permission: orders.manage');
    }
    const orderId = await resolveOrderId(this.prisma, idOrNo);
    await this.prisma.$transaction(async (tx) => {
      // Conditional update: two staff acting at once, only one wins.
      const res = await tx.order.updateMany({
        where: { id: orderId, callStatus: 'pending' },
        data: {
          callStatus: outcome,
          callNote: note ?? null,
          callStaffId: ctx.staff.id,
          callAt: new Date(),
        },
      });
      if (res.count === 0) {
        throw new OrdersAdminError(
          HttpStatus.CONFLICT,
          'CALL_NOT_PENDING',
          'This order is not waiting for a call.',
        );
      }
      if (outcome === 'cancelled') {
        await this.cancel.cancelInTx(
          tx,
          orderId,
          { type: 'staff', id: ctx.staff.id },
          note ?? 'Cancelled after confirmation call',
        );
      }
    });
    return { orderId };
  }
}
