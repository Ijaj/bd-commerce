import { Banner } from '@bdc/ui';
import { Badge, Button, Loader } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { bulkApi } from './api';
import classes from './BulkSales.module.css';
import { bulkErrorMessage, describeRule } from './logic';
import { type BulkDetail, bulkDetailQuery, useInvalidateBulk } from './queries';

type Item = BulkDetail['items'][number];

export function BulkSaleDetailPage({ id }: { id: string }) {
  const canManage = useCan('bulk_sales.manage');
  const invalidate = useInvalidateBulk();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ restored: number; skippedChanged: number } | null>(null);
  const detail = useQuery(bulkDetailQuery(id, page, pageSize));

  const undo = useMutation({
    mutationFn: () => bulkApi.undo(id),
    onSuccess: (r) => {
      setResult(r);
      invalidate();
    },
  });

  if (detail.isLoading) {
    return (
      <div className="a-card">
        <div className="a-empty">
          <Loader size="sm" />
        </div>
      </div>
    );
  }
  if (detail.error || !detail.data) {
    return (
      <Banner tone="danger">
        {bulkErrorMessage(detail.error, 'Could not load this bulk sale')}
      </Banner>
    );
  }
  const batch = detail.data;
  const undone = !!batch.undoneAt;

  const columns: Column<Item>[] = [
    {
      key: 'variant',
      header: 'Variant',
      render: (i) => (
        <div>
          {i.title}
          <span className={classes.sub}>{i.sku}</span>
        </div>
      ),
    },
    { key: 'price', header: 'Regular', align: 'right', render: (i) => formatPrice(i.priceP) },
    {
      key: 'prev',
      header: 'Sale before',
      align: 'right',
      render: (i) => (i.prevSalePriceP === null ? '-' : formatPrice(i.prevSalePriceP)),
    },
    {
      key: 'new',
      header: 'Sale price set',
      align: 'right',
      render: (i) => formatPrice(i.newSalePriceP),
    },
  ];

  return (
    <>
      <Button component={Link} to="/promotions/bulk-sales" variant="subtle" size="xs" mb="xs">
        All bulk sales
      </Button>
      <PageHeader
        title={batch.name}
        crumbs={['Marketing', 'Bulk sales', batch.name]}
        description={`${describeRule(batch.mode, batch.value, formatPrice)} on ${batch.itemCount} variants, applied ${formatDateTime(batch.createdAt)}${batch.createdByName ? ` by ${batch.createdByName}` : ''}`}
        actions={
          <>
            <Badge variant="light" color={undone ? 'gray' : 'green'}>
              {undone ? 'Undone' : 'Applied'}
            </Badge>
            {canManage && !undone && (
              <Button color="red" variant="light" onClick={() => setConfirming(true)}>
                Undo
              </Button>
            )}
          </>
        }
      />
      <p className={`${classes.muted} ${classes.banners}`}>
        Sale window:{' '}
        {batch.startsAt ? formatDateTime(batch.startsAt) : 'from the moment it was applied'} to{' '}
        {batch.endsAt ? formatDateTime(batch.endsAt) : 'no end'}.
        {undone && batch.undoneAt ? ` Undone ${formatDateTime(batch.undoneAt)}.` : ''}
      </p>
      {result && (
        <Banner
          tone={result.skippedChanged > 0 ? 'warn' : 'info'}
          icon={result.skippedChanged > 0 ? 'warn' : 'check'}
        >
          Restored {result.restored} variant{result.restored === 1 ? '' : 's'}.
          {result.skippedChanged > 0 &&
            ` ${result.skippedChanged} were left as they are because their sale price was changed after this batch.`}
        </Banner>
      )}
      <DataTable
        columns={columns}
        rows={batch.items}
        rowKey={(i) => i.variantId}
        loading={detail.isFetching && !batch.items.length}
        emptyMessage="No variants in this batch."
        page={page}
        pageSize={pageSize}
        total={batch.total}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        pageSizeOptions={[50, 100, 200]}
      />
      <ConfirmDelete
        opened={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          try {
            await undo.mutateAsync();
          } catch (e) {
            throw new Error(bulkErrorMessage(e));
          }
        }}
        loading={undo.isPending}
        title="Undo bulk sale"
        confirmLabel="Undo"
      >
        This puts back the sale prices these variants had before "{batch.name}". Variants whose sale
        price was edited since are left alone.
      </ConfirmDelete>
    </>
  );
}
