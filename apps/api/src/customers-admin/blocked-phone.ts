import { HttpStatus } from '@nestjs/common';
import { normalizePhone } from '../customers/phone';
import { CustomerAdminError } from './customers-admin.errors';

interface CustomerFinder {
  customer: {
    findFirst(args: {
      where: { phone: { in: string[] }; disabledAt: { not: null } };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

/**
 * C88: a phone that belongs to a blocked customer cannot buy, as guest or as ship-to contact.
 * The reason is never shown to the buyer.
 */
export async function assertPhonesNotBlocked(
  db: CustomerFinder,
  phones: (string | null | undefined)[],
) {
  const list = [
    ...new Set(
      phones.map((p) => (p ? normalizePhone(p) : null)).filter((p): p is string => p !== null),
    ),
  ];
  if (list.length === 0) return;
  const hit = await db.customer.findFirst({
    where: { phone: { in: list }, disabledAt: { not: null } },
    select: { id: true },
  });
  if (hit) {
    throw new CustomerAdminError(
      HttpStatus.FORBIDDEN,
      'CUSTOMER_BLOCKED',
      "We can't take this order. Please contact support.",
    );
  }
}
