import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductCardService } from '../storefront/product-card.service';
import { CustomerError } from './customers.errors';

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: ProductCardService,
  ) {}

  /** Same visibility rule as the public catalog: active and already published. */
  private publicProduct(now: Date) {
    return {
      status: 'active' as const,
      publishedAt: { lte: now },
      primaryCategory: { isActive: true },
    };
  }

  async ids(customerId: string) {
    const rows = await this.prisma.wishlist.findMany({
      where: { customerId },
      orderBy: { addedAt: 'desc' },
      select: { productId: true },
    });
    return { productIds: rows.map((r) => r.productId) };
  }

  async add(customerId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...this.publicProduct(new Date()) },
      select: { id: true },
    });
    if (!product) throw new CustomerError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Product not found.');
    await this.prisma.wishlist.upsert({
      where: { customerId_productId: { customerId, productId } },
      create: { customerId, productId },
      update: {},
    });
  }

  async remove(customerId: string, productId: string) {
    await this.prisma.wishlist.deleteMany({ where: { customerId, productId } });
  }

  async list(customerId: string) {
    const rows = await this.prisma.wishlist.findMany({
      where: { customerId },
      orderBy: { addedAt: 'desc' },
      select: { productId: true, addedAt: true },
    });
    // Cards drop products that stopped being public.
    const cards = await this.cards.cards(rows.map((r) => r.productId));
    const addedAt = new Map(rows.map((r) => [r.productId, r.addedAt.toISOString()]));
    return { items: cards.map((c) => ({ ...c, addedAt: addedAt.get(c.id) as string })) };
  }
}
