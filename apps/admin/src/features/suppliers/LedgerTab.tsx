import { SectionCard, StatusBadge } from '@bdc/ui';
import { Button } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { type Column, DataTable } from '~/components/DataTable';
import { formatDateTime, formatPrice } from '~/lib/format';
import { AdjustmentModal } from './AdjustmentModal';
import { Balance } from './components';
import { canReverse, LEDGER_TYPE } from './logic';
import { PaymentModal } from './PaymentModal';
import { type LedgerEntry, ledgerQuery } from './queries';
import { ReverseModal } from './ReverseModal';
import classes from './suppliers.module.css';

export function LedgerTab({
  supplierId,
  supplierName,
  canPay,
}: {
  supplierId: string;
  supplierName: string;
  canPay: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const ledger = useQuery(ledgerQuery(supplierId, page, pageSize));
  const [paying, setPaying] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [reversing, setReversing] = useState<LedgerEntry | null>(null);
  const balanceP = ledger.data?.balanceP ?? 0;

  const columns: Column<LedgerEntry>[] = [
    { key: 'at', header: 'Date', className: 'a-nowrap', render: (e) => formatDateTime(e.at) },
    {
      key: 'type',
      header: 'Type',
      render: (e) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <StatusBadge tone={LEDGER_TYPE[e.type].tone}>{LEDGER_TYPE[e.type].label}</StatusBadge>
          {e.reversedById && <StatusBadge tone="muted">Reversed</StatusBadge>}
        </span>
      ),
    },
    {
      key: 'po',
      header: 'PO',
      render: (e) =>
        e.poId && e.poNo ? (
          <Link to="/purchase-orders/$id" params={{ id: e.poId }}>
            {e.poNo}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'ref',
      header: 'Method / reference',
      render: (e) =>
        e.method || e.reference ? (
          <span>
            {e.method}
            {e.reference && <span className={`sub ${classes.mono}`}>{e.reference}</span>}
          </span>
        ) : (
          '-'
        ),
    },
    { key: 'note', header: 'Note', render: (e) => e.note ?? '-' },
    {
      key: 'amount',
      header: 'Amount',
      className: 'num',
      render: (e) => (
        <span className={e.amountP < 0 ? classes.neg : e.amountP > 0 ? classes.pos : undefined}>
          {e.amountP < 0 ? `−${formatPrice(-e.amountP)}` : `+${formatPrice(e.amountP)}`}
        </span>
      ),
    },
    {
      key: 'after',
      header: 'Balance after',
      className: 'num',
      render: (e) => <Balance balanceP={e.balanceAfterP} />,
    },
    ...(canPay
      ? [
          {
            key: 'act',
            header: '',
            className: 'act',
            render: (e: LedgerEntry) =>
              canReverse(e) ? (
                <Button size="compact-sm" variant="default" onClick={() => setReversing(e)}>
                  Reverse
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <>
      <SectionCard
        title="Balance owed"
        className="a-gap"
        actions={
          canPay && (
            <span className={classes.rowActions}>
              <Button size="compact-sm" onClick={() => setPaying(true)}>
                Record payment
              </Button>
              <Button size="compact-sm" variant="default" onClick={() => setAdjusting(true)}>
                Adjustment
              </Button>
            </span>
          )
        }
      >
        <div className={classes.big}>
          <Balance balanceP={balanceP} />
        </div>
        <div className={`${classes.muted} ${classes.small}`}>
          Goods received add to the balance; payments reduce it.
        </div>
      </SectionCard>
      <SectionCard title="Ledger" flush>
        <DataTable
          columns={columns}
          rows={ledger.data?.items}
          rowKey={(e) => e.id}
          loading={ledger.isLoading}
          emptyMessage="No ledger entries yet. Receiving a purchase order adds the first one."
          page={page}
          pageSize={pageSize}
          total={ledger.data?.total}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          pageSizeOptions={[25, 50, 100]}
        />
      </SectionCard>
      {paying && (
        <PaymentModal
          supplierId={supplierId}
          supplierName={supplierName}
          balanceP={balanceP}
          onClose={() => setPaying(false)}
        />
      )}
      {adjusting && (
        <AdjustmentModal
          supplierId={supplierId}
          supplierName={supplierName}
          balanceP={balanceP}
          onClose={() => setAdjusting(false)}
        />
      )}
      {reversing && <ReverseModal entry={reversing} onClose={() => setReversing(null)} />}
    </>
  );
}
