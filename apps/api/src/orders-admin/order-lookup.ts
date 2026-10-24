import { HttpStatus } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { CommerceError } from '../orders/commerce.errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin routes take either the uuid or the human order number. */
export function orderKey(idOrNo: string): Prisma.OrderWhereUniqueInput {
  return UUID.test(idOrNo) ? { id: idOrNo } : { orderNo: idOrNo };
}

export async function resolveOrderId(
  db: Pick<Prisma.TransactionClient, 'order'>,
  idOrNo: string,
): Promise<string> {
  const o = await db.order.findUnique({ where: orderKey(idOrNo), select: { id: true } });
  if (!o) throw new CommerceError(HttpStatus.NOT_FOUND, 'ORDER_NOT_FOUND', 'Order not found.');
  return o.id;
}

/** Order lists are shown in Bangladesh time: a plain date starts at 00:00 Asia/Dhaka (UTC+6). */
export function dayStart(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00+06:00` : value);
}
export function dayEndExclusive(value: string): Date {
  if (value.length !== 10) return new Date(value);
  return new Date(dayStart(value).getTime() + 86_400_000);
}
