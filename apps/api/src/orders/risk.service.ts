import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

/**
 * Call-queue risk assessment (C53, Q54). Called by checkout inside the placement transaction
 * right after the order row exists. Sets riskScore / riskReasons / callStatus on the order.
 * Never blocks the order. Implemented in step 5 (orders-admin agent).
 */
@Injectable()
export class RiskService {
  async assess(_tx: Prisma.TransactionClient, _orderId: string): Promise<void> {}
}
