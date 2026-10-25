import { Alert, Badge, Button, Group, Loader, Table, Text, Title } from '@mantine/core';
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
    <section>
      <Group justify="space-between" mb="xs">
        <Title order={4}>Invoices</Title>
        {canIssue && (
          <Button
            size="compact-md"
            variant={items.length ? 'light' : 'filled'}
            loading={issue.isPending}
            onClick={() => issue.mutate(items.length > 0)}
          >
            {items.length ? 'Reissue invoice' : 'Issue invoice'}
          </Button>
        )}
      </Group>
      {list.isLoading && <Loader size="sm" />}
      {list.isError && <Alert color="red">{list.error.message}</Alert>}
      {list.data && items.length === 0 && (
        <Text size="sm" c="dimmed">
          No invoice issued yet.
        </Text>
      )}
      {items.length > 0 && (
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Invoice</Table.Th>
                <Table.Th>Issued</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th ta="right">VAT included</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((inv) => (
                <Table.Tr key={inv.id}>
                  <Table.Td>
                    {inv.invoiceNo}{' '}
                    {!inv.isCurrent && (
                      <Badge size="xs" variant="light" color="gray">
                        Superseded
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{formatDateTime(inv.issuedAt)}</Table.Td>
                  <Table.Td ta="right">{formatPrice(inv.grandTotalP)}</Table.Td>
                  <Table.Td ta="right">{formatPrice(inv.vatTotalP)}</Table.Td>
                  <Table.Td ta="right">
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <Button
                        component="a"
                        href={`/print/invoice/${inv.id}`}
                        target="_blank"
                        rel="noopener"
                        size="compact-sm"
                        variant="light"
                      >
                        Print (EN)
                      </Button>
                      <Button
                        component="a"
                        href={`/print/invoice/${inv.id}?lang=bn`}
                        target="_blank"
                        rel="noopener"
                        size="compact-sm"
                        variant="light"
                      >
                        Print (BN)
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </section>
  );
}
