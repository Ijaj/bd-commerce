import type { CodeRejectReason } from '../types';
import type { CouponRow, CouponUsage } from './engine.types';

/**
 * Usage limits shared by evaluation (read counts) and redemption (counts re-read under the row lock).
 * `discountP` is what this order would add to the budget; pass 0 when only the plain caps matter.
 */
export function limitReason(
  c: Pick<
    CouponRow,
    | 'maxUsesTotal'
    | 'maxPerCustomer'
    | 'maxPerPhone'
    | 'maxPerDevice'
    | 'budgetCapP'
    | 'usesCount'
    | 'discountGivenP'
  >,
  usage: CouponUsage,
  who: { customerId: string | null; phone: string | null; visitorId: string | null },
  discountP = 0,
): CodeRejectReason | null {
  if (c.maxUsesTotal !== null && c.usesCount >= c.maxUsesTotal) return 'LIMIT_REACHED';
  if (c.maxPerCustomer !== null && who.customerId && usage.customer >= c.maxPerCustomer) {
    return 'LIMIT_REACHED';
  }
  if (c.maxPerPhone !== null && who.phone && usage.phone >= c.maxPerPhone) return 'LIMIT_REACHED';
  if (c.maxPerDevice !== null && who.visitorId && usage.device >= c.maxPerDevice) {
    return 'LIMIT_REACHED';
  }
  if (c.budgetCapP !== null && c.discountGivenP + discountP > c.budgetCapP) {
    return 'BUDGET_REACHED';
  }
  return null;
}
