import { Alert, Badge, Button, Loader, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ConfirmDelete } from '~/components/ConfirmDelete';
import { type Column, DataTable } from '~/components/DataTable';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { bulkApi } from './api';
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

  if (detail.isLoading) return <Loader />;
  if (detail.error || !detail.data) {
    return (
      <Alert color="red" role="alert">
        {bulkErrorMessage(detail.error, 'Could not load this bulk sale')}
      </Alert>
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
          <Text size="sm">{i.title}</Text>
          <Text size="xs" c="dimmed">
            {i.sku}
          </Text>
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
      <Button
        component={Link}
        to="/promotions/bulk-sales"
        variant="subtle"
        size="xs"
        leftSection={<IconArrowLeft size={14} />}
        mb="xs"
      >
        All bulk sales
      </Button>
      <PageHeader
        title={batch.name}
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
      <Text size="sm" c="dimmed" mb="md">
        Sale window:{' '}
        {batch.startsAt ? formatDateTime(batch.startsAt) : 'from the moment it was applied'} to{' '}
        {batch.endsAt ? formatDateTime(batch.endsAt) : 'no end'}.
        {undone && batch.undoneAt ? ` Undone ${formatDateTime(batch.undoneAt)}.` : ''}
      </Text>
      {result && (
        <Alert color={result.skippedChanged > 0 ? 'yellow' : 'green'} mb="md" role="status">
          Restored {result.restored} variant{result.restored === 1 ? '' : 's'}.
          {result.skippedChanged > 0 &&
            ` ${result.skippedChanged} were left as they are because their sale price was changed after this batch.`}
        </Alert>
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
