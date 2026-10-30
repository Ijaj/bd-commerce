import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  SupplierAdjustmentDto,
  SupplierLedgerQueryDto,
  SupplierLedgerReverseDto,
  SupplierPaymentDto,
} from './suppliers.dto';
import { SupplierError } from './suppliers.errors';
import { SuppliersService } from './suppliers.service';

const MAX_BALANCE_P = 2_000_000_000;

type EntryRow = {
  id: string;
  type: 'receipt' | 'payment' | 'adjustment' | 'dropship' | 'reversal';
  amount_p: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  po_receipt_id: string | null;
  po_id: string | null;
  po_no: string | null;
  reverses_id: string | null;
  reversed_by_id: string | null;
  recorded_by_id: string;
  recorded_by_name: string;
  at: Date;
  balance_after: bigint;
};

function toView(r: EntryRow) {
  return {
    id: r.id,
    type: r.type,
    amountP: r.amount_p,
    balanceAfterP: Number(r.balance_after),
    method: r.method,
    reference: r.reference,
    note: r.note,
    poReceiptId: r.po_receipt_id,
    poId: r.po_id,
    poNo: r.po_no,
    reversesId: r.reverses_id,
    reversedById: r.reversed_by_id,
    recordedBy: { id: r.recorded_by_id, name: r.recorded_by_name },
    at: r.at.toISOString(),
  };
}

/**
 * Supplier payables ledger (C65, C76, C77). Append-only: the supplier row is locked for every
 * write so concurrent payments and reversals queue up, and a mistake is fixed by a reversal entry.
 */
@Injectable()
export class SupplierLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suppliers: SuppliersService,
  ) {}

  async list(supplierId: string, q: SupplierLedgerQueryDto) {
    await this.suppliers.assertExists(supplierId);
    const [rows, balanceP] = await Promise.all([
      this.entries(this.prisma, supplierId, {
        limit: q.pageSize,
        offset: (q.page - 1) * q.pageSize,
      }),
      this.balance(this.prisma, supplierId),
    ]);
    const total = await this.prisma.supplierLedger.count({ where: { supplierId } });
    return { balanceP, items: rows.map(toView), total };
  }

  async recordPayment(staffId: string, supplierId: string, body: SupplierPaymentDto) {
    return this.write(supplierId, async (tx) => {
      const entry = await tx.supplierLedger.create({
        data: {
          supplierId,
          type: 'payment',
          amountP: -body.amountP,
          method: body.method,
          reference: body.reference || null,
          note: body.note || null,
          recordedById: staffId,
        },
      });
      return entry.id;
    });
  }

  async recordAdjustment(staffId: string, supplierId: string, body: SupplierAdjustmentDto) {
    return this.write(supplierId, async (tx) => {
      const entry = await tx.supplierLedger.create({
        data: {
          supplierId,
          type: 'adjustment',
          amountP: body.amountP,
          note: body.note,
          recordedById: staffId,
        },
      });
      return entry.id;
    });
  }

  async reverse(staffId: string, entryId: string, body: SupplierLedgerReverseDto) {
    const original = await this.prisma.supplierLedger.findUnique({ where: { id: entryId } });
    if (!original) {
      throw new SupplierError(
        HttpStatus.NOT_FOUND,
        'LEDGER_ENTRY_NOT_FOUND',
        'Ledger entry not found',
      );
    }
    return this.write(original.supplierId, async (tx) => {
      if (original.type !== 'payment' && original.type !== 'adjustment') {
        throw new SupplierError(
          HttpStatus.CONFLICT,
          'LEDGER_NOT_REVERSIBLE',
          'Only payments and adjustments can be reversed',
        );
      }
      // Re-checked under the supplier lock so two parallel reversals cannot both pass.
      const done = await tx.supplierLedger.findUnique({ where: { reversesId: entryId } });
      if (done) {
        throw new SupplierError(
          HttpStatus.CONFLICT,
          'LEDGER_ALREADY_REVERSED',
          'This entry was already reversed',
        );
      }
      const entry = await tx.supplierLedger.create({
        data: {
          supplierId: original.supplierId,
          type: 'reversal',
          amountP: -original.amountP,
          reversesId: entryId,
          note: body.note,
          recordedById: staffId,
        },
      });
      return entry.id;
    });
  }

  /** Locks the supplier, runs the insert, checks the balance stays in int4 range, returns the entry view. */
  private async write(supplierId: string, fn: (tx: Prisma.TransactionClient) => Promise<string>) {
    await this.suppliers.assertExists(supplierId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM suppliers WHERE id = ${supplierId}::uuid FOR UPDATE`;
      const id = await fn(tx);
      const balanceP = await this.balance(tx, supplierId);
      if (Math.abs(balanceP) > MAX_BALANCE_P) {
        throw new SupplierError(
          HttpStatus.CONFLICT,
          'LEDGER_OVERFLOW',
          'Supplier balance is out of range',
        );
      }
      const [row] = await this.entries(tx, supplierId, { id });
      return { ...toView(row as EntryRow), balanceP };
    });
  }

  private async balance(db: Prisma.TransactionClient | PrismaService, supplierId: string) {
    const [sum] = await db.$queryRaw<{ bal: bigint }[]>`
      SELECT coalesce(sum(amount_p), 0)::bigint AS bal FROM supplier_ledger
      WHERE supplier_id = ${supplierId}::uuid`;
    return Number(sum?.bal ?? 0);
  }

  /** The running balance is a window over the whole ledger, so paging happens after it is computed. */
  private entries(
    db: Prisma.TransactionClient | PrismaService,
    supplierId: string,
    o: { id?: string; limit?: number; offset?: number },
  ) {
    return db.$queryRaw<EntryRow[]>`
      SELECT * FROM (
        SELECT l.id, l.type::text AS type, l.amount_p, l.method, l.reference, l.note,
               l.po_receipt_id, r.po_id, po.po_no, l.reverses_id, rv.id AS reversed_by_id,
               l.recorded_by_id, s.name AS recorded_by_name, l.at,
               sum(l.amount_p) OVER (ORDER BY l.at, l.id)::bigint AS balance_after
        FROM supplier_ledger l
        JOIN staff s ON s.id = l.recorded_by_id
        LEFT JOIN po_receipts r ON r.id = l.po_receipt_id
        LEFT JOIN purchase_orders po ON po.id = r.po_id
        LEFT JOIN supplier_ledger rv ON rv.reverses_id = l.id
        WHERE l.supplier_id = ${supplierId}::uuid
      ) x
      WHERE ${o.id ?? null}::uuid IS NULL OR x.id = ${o.id ?? null}::uuid
      ORDER BY x.at DESC, x.id DESC
      LIMIT ${o.limit ?? 1} OFFSET ${o.offset ?? 0}`;
  }
}
