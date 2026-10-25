import { Banner, EmptyState, SectionCard, TableWrap } from '@bdc/ui';
import { Badge, Button, Group, Loader, Table } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifyApiError } from '~/features/b2b/errors';
import { notifyOk } from '~/features/categories/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { documentsApi } from './api';
import { orderInvoicesQuery } from './queries';

/** Invoices of one order: issue, reissue (keeps old ones for reference) and open the print view. */
export function OrderInvoicesSection({ orderId }: { orderId: string }) {
  const canIssue = useCan('shipments.manage');
  const qc = useQueryClient();
  const list = useQuery(orderInvoicesQuery(orderId));
  const items = list.data?.items ?? [];

  const issue = useMutation({
    mutationFn: (reissue: boolean) => documentsApi.issue(orderId, reissue),
    onSuccess: (inv) => {
      notifyOk(`Invoice ${inv.invoiceNo} issued`);
      qc.invalidateQueries({ queryKey: ['documents', 'invoices', orderId] });
    },
    onError: (e) => notifyApiError(e, 'Could not issue the invoice'),
  });

  return (
    <SectionCard
      title="Invoices"
      flush={items.length > 0}
      actions={
        canIssue ? (
          <Button
            size="compact-sm"
            variant={items.length ? 'default' : 'filled'}
            loading={issue.isPending}
            onClick={() => issue.mutate(items.length > 0)}
          >
            {items.length ? 'Reissue invoice' : 'Issue invoice'}
          </Button>
        ) : undefined
      }
    >
      {list.isLoading && <Loader size="sm" />}
      {list.isError && <Banner tone="danger">{list.error.message}</Banner>}
      {list.data && items.length === 0 && (
        <EmptyState icon="reports" title="No invoice issued yet." />
      )}
      {items.length > 0 && (
        <TableWrap>
          <Table miw={480}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice</Table.Th>
                <Table.Th>Issued</Table.Th>
                <Table.Th className="num">Total</Table.Th>
                <Table.Th className="num">VAT included</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>
                    {inv.invoiceNo}{' '}
                    {!inv.isCurrent && (
                      <Badge size="xs" color="gray">
                        Superseded
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{formatDateTime(inv.issuedAt)}</Table.Td>
                  <Table.Td className="num">{formatPrice(inv.grandTotalP)}</Table.Td>
                  <Table.Td className="num">{formatPrice(inv.vatTotalP)}</Table.Td>
                  <Table.Td className="act">
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Button
                        component="a"
                        href={`/print/invoice/${inv.id}`}
                        target="_blank"
                        rel="noopener"
                        size="compact-sm"
                        variant="default"
                      >
                        Print (EN)
                      </Button>
                      <Button
                        component="a"
                        href={`/print/invoice/${inv.id}?lang=bn`}
                        target="_blank"
                        rel="noopener"
                        size="compact-sm"
                        variant="default"
                      >
                        Print (BN)
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </TableWrap>
      )}
    </SectionCard>
  );
}
