import type { Prisma } from '../generated/prisma/client';

/**
 * C85: `products.sold_count` counts units at order placed. Placing adds, cancelling subtracts
 * (never below 0); returns leave it alone. Rows are touched in product-id order (no deadlocks).
 */
export async function adjustSoldCount(
  tx: Prisma.TransactionClient,
  items: { productId: string; qty: number }[],
  direction: 1 | -1,
) {
  const byProduct = new Map<string, number>();
  for (const i of items) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.qty);
  for (const productId of [...byProduct.keys()].sort()) {
    const delta = (byProduct.get(productId) ?? 0) * direction;
    await tx.$executeRaw`UPDATE products SET sold_count = GREATEST(0, sold_count + ${delta}) WHERE id = ${productId}::uuid`;
  }
}
