import {
  Alert,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmAction, ReasonModal } from '~/features/b2b/components';
import { notifyError, notifyOk } from '~/features/categories/queries';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import { memoUrl, srApi } from './api';
import {
  allowedActions,
  extrasOf,
  hasMemo,
  type SaleAction,
  type SaleStatusX,
  STATUS_COLOR,
  STATUS_LABEL,
} from './logic';
import { saleQuery, useInvalidateSales } from './queries';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" component="div">
        {children}
      </Text>
    </div>
  );
}

export function SaleDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const canAct = useCan('sr.approve');
  const invalidate = useInvalidateSales();
  const q = useQuery({ ...saleQuery(id ?? ''), enabled: !!id });
  const [action, setAction] = useState<SaleAction | null>(null);
  const sale = q.data;
  const status = sale?.status as SaleStatusX | undefined;
  const extra = sale ? extrasOf(sale) : {};
  const actions = status && canAct ? allowedActions(status) : [];

  const done = (msg: string) => {
    notifyOk(msg);
    invalidate();
  };

  return (
    <Drawer
      opened={!!id}
      onClose={onClose}
      position="right"
      size="lg"
      title={sale ? `Sale ${sale.memoNo}` : 'Sale'}
    >
      {q.isLoading && <Loader size="sm" />}
      {q.isError && <Alert color="red">{(q.error as Error).message}</Alert>}
      {sale && status && (
        <Stack>
          <Group gap="xs">
            <Badge variant="light" color={STATUS_COLOR[status]}>
              {STATUS_LABEL[status]}
            </Badge>
            {extra.deliveryBy && (
              <Badge variant="outline" color="gray">
                Delivery: {extra.deliveryBy === 'sr' ? 'SR delivers' : 'Staff delivers'}
              </Badge>
            )}
          </Group>

          <SimpleGrid cols={2}>
            <Fact label="Shop">
              {sale.shop.name}
              <Text size="xs" c="dimmed">
                {sale.shop.phone}
              </Text>
            </Fact>
            <Fact label="Sales rep">{sale.sr.name}</Fact>
            <Fact label="Submitted">{formatDateTime(sale.submittedAt)}</Fact>
            {sale.approvedAt && (
              <Fact label="Approved">
                {formatDateTime(sale.approvedAt)} by {sale.approvedBy?.name ?? '-'}
              </Fact>
            )}
            {sale.deliveredAt && (
              <Fact label="Delivered">
                {formatDateTime(sale.deliveredAt)} by {sale.deliveredBy?.name ?? '-'}
              </Fact>
            )}
            {extra.reversedAt && (
              <Fact label="Reversed">
                {formatDateTime(extra.reversedAt)} by {extra.reversedBy?.name ?? '-'}
              </Fact>
            )}
          </SimpleGrid>
          {sale.note && <Fact label="Note">{sale.note}</Fact>}
          {sale.rejectedReason && (
            <Alert color="red" variant="light" title="Rejected">
              {sale.rejectedReason}
            </Alert>
          )}
          {extra.reverseReason && (
            <Alert color="orange" variant="light" title="Reversed">
              {extra.reverseReason}
            </Alert>
          )}

          <Table.ScrollContainer minWidth={420}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                  <Table.Th ta="right">Line total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sale.items.map((i) => (
                  <Table.Tr key={i.id}>
                    <Table.Td>
                      <Text size="sm">{i.titleEn}</Text>
                      <Text size="xs" c="dimmed">
                        {i.sku}
                        {i.optionsText ? ` · ${i.optionsText}` : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">{i.qty}</Table.Td>
                    <Table.Td ta="right">{formatPrice(i.unitPriceP)}</Table.Td>
                    <Table.Td ta="right">{formatPrice(i.lineTotalP)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Stack gap={2} align="flex-end">
            <Text size="sm">Total: {formatPrice(sale.totalP)}</Text>
            <Text size="sm">Paid at sale: {formatPrice(sale.paidAtSaleP)}</Text>
            <Text size="sm" fw={500} c={sale.dueP > 0 ? 'red' : undefined}>
              Due: {formatPrice(sale.dueP)}
            </Text>
          </Stack>

          <Divider />
          <Group justify="space-between">
            {hasMemo(status) ? (
              <Group gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  component="a"
                  href={memoUrl(sale.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View memo
                </Button>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={async () => {
                    try {
                      const { url } = await srApi.memoLink(sale.id);
                      await navigator.clipboard.writeText(url);
                      notifyOk('Memo link copied');
                    } catch (e) {
                      notifyError(e, 'Could not copy the memo link');
                    }
                  }}
                >
                  Copy shareable link
                </Button>
              </Group>
            ) : (
              <span />
            )}
            <Group gap="xs">
              {actions.includes('reject') && (
                <Button size="xs" variant="default" color="red" onClick={() => setAction('reject')}>
                  Reject
                </Button>
              )}
              {actions.includes('approve') && (
                <Button size="xs" onClick={() => setAction('approve')}>
                  Approve
                </Button>
              )}
              {actions.includes('reverse') && (
                <Button
                  size="xs"
                  variant="default"
                  color="red"
                  onClick={() => setAction('reverse')}
                >
                  Reverse
                </Button>
              )}
              {actions.includes('deliver') && (
                <Button size="xs" onClick={() => setAction('deliver')}>
                  Mark delivered
                </Button>
              )}
            </Group>
          </Group>

          <ConfirmAction
            opened={action === 'approve'}
            onClose={() => setAction(null)}
            title="Approve sale"
            confirmLabel="Approve"
            onConfirm={async () => {
              await srApi.approve(sale.id);
              done('Sale approved');
            }}
          >
            Approve <b>{sale.memoNo}</b>? {formatPrice(sale.dueP)} is added to {sale.shop.name}'s
            due and the memo becomes available. Stock stays reserved until delivery.
          </ConfirmAction>

          <ConfirmAction
            opened={action === 'deliver'}
            onClose={() => setAction(null)}
            title="Mark delivered"
            confirmLabel="Mark delivered"
            onConfirm={async () => {
              await srApi.deliver(sale.id);
              done('Sale marked delivered');
            }}
          >
            Mark <b>{sale.memoNo}</b> delivered? Stock is deducted now.
          </ConfirmAction>

          <ReasonModal
            opened={action === 'reject'}
            onClose={() => setAction(null)}
            title="Reject sale"
            confirmLabel="Reject sale"
            onSubmit={async (reason) => {
              await srApi.reject(sale.id, reason);
              done('Sale rejected');
            }}
          >
            Reject <b>{sale.memoNo}</b>? Reserved stock is released. The SR sees your reason.
          </ReasonModal>

          <ReasonModal
            opened={action === 'reverse'}
            onClose={() => setAction(null)}
            title="Reverse sale"
            confirmLabel="Reverse sale"
            onSubmit={async (reason) => {
              await srApi.reverse(sale.id, reason);
              done('Sale reversed');
            }}
          >
            Reverse <b>{sale.memoNo}</b>? The remaining due is cancelled and stock goes back. This
            cannot be undone.
          </ReasonModal>
        </Stack>
      )}
    </Drawer>
  );
}
