import type { Prisma } from '../../generated/prisma/client';

/**
 * Called by purchase orders (C74): creates the variant↔supplier link if missing and keeps `costP`
 * at the latest cost. The first link of a variant becomes its default supplier.
 */
export async function upsertSupplierLink(
  tx: Prisma.TransactionClient,
  supplierId: string,
  variantId: string,
  costP: number,
): Promise<void> {
  const existing = await tx.variantSupplier.findUnique({
    where: { variantId_supplierId: { variantId, supplierId } },
    select: { id: true },
  });
  if (existing) {
    await tx.variantSupplier.update({ where: { id: existing.id }, data: { costP } });
    return;
  }
  const others = await tx.variantSupplier.count({ where: { variantId } });
  await tx.variantSupplier.create({
    data: { supplierId, variantId, costP, isDefault: others === 0 },
  });
}
