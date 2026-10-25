import { Alert, Anchor, Button, Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '~/components/PageHeader';
import { formatDateTime, formatPrice } from '~/lib/format';
import { useCan } from '~/lib/perm';
import type { CallOutcome } from './api';
import { CallBadge, RiskBadge } from './badges';
import { CallOutcomeModal } from './CallOutcomeModal';
import { riskReasonText } from './logic';
import { callQueueQuery, type OrderListItem } from './queries';

const PAGE_SIZE = 25;

function QueueRow({
  order,
  pending,
  onOutcome,
}: {
  order: OrderListItem;
  pending: boolean;
  onOutcome?: (o: CallOutcome) => void;
}) {
  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Group gap="xs">
            <Link to="/orders/$id" params={{ id: order.id }}>
              <Anchor component="span" size="sm">
                {order.orderNo}
              </Anchor>
            </Link>
            <Text size="xs" c="dimmed">
              {formatDateTime(order.placedAt)}
            </Text>
            <RiskBadge score={order.riskScore} reasons={order.riskReasons} />
            {!pending && <CallBadge status={order.callStatus} />}
          </Group>
          <Text size="sm">
            {order.customer.name}
            {order.customer.isGuest ? ' (guest)' : ''} · {order.customer.phone}
          </Text>
          <Text size="xs" c="dimmed">
            {order.shipPlaceText} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} ·{' '}
            {formatPrice(order.grandTotalP)}
            {order.codDueP > 0 ? ` (COD ${formatPrice(order.codDueP)})` : ''}
          </Text>
          {order.riskReasons.length > 0 && (
            <Text size="xs" c="orange">
              {order.riskReasons.map(riskReasonText).join(', ')}
            </Text>
          )}
          {!pending && order.callNote && <Text size="xs">{order.callNote}</Text>}
        </Stack>
        {pending && onOutcome && (
          <Group gap={4} wrap="nowrap">
            <Button size="compact-sm" onClick={() => onOutcome('confirmed')}>
              Confirmed
            </Button>
            <Button size="compact-sm" variant="default" onClick={() => onOutcome('unreachable')}>
              Unreachable
            </Button>
            <Button
              size="compact-sm"
              variant="default"
              color="red"
              onClick={() => onOutcome('cancelled')}
            >
              Cancelled
            </Button>
          </Group>
        )}
      </Group>
    </Paper>
  );
}

export function CallQueuePage() {
  const canCall = useCan('orders.call');
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [page, setPage] = useState(1);
  const list = useQuery({ ...callQueueQuery(tab, page, PAGE_SIZE), enabled: canCall });
  const [active, setActive] = useState<{ order: OrderListItem; outcome: CallOutcome } | null>(null);
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (!canCall)
    return <Alert color="gray">You do not have permission to use the call queue.</Alert>;

  return (
    <div>
      <PageHeader
        title="Call queue"
        description="Orders flagged as risky. Call the customer, then record the outcome. Oldest first."
      />
      <SegmentedControl
        mb="sm"
        aria-label="Queue"
        value={tab}
        onChange={(v) => {
          setTab(v as 'pending' | 'done');
          setPage(1);
        }}
        data={[
          { value: 'pending', label: 'Pending' },
          { value: 'done', label: 'Done' },
        ]}
      />
      {list.isError && <Alert color="red">{(list.error as Error).message}</Alert>}
      <Stack gap="xs">
        {list.data?.items.map((o) => (
          <QueueRow
            key={o.id}
            order={o}
            pending={tab === 'pending'}
            onOutcome={(outcome) => setActive({ order: o, outcome })}
          />
        ))}
        {list.data && list.data.items.length === 0 && (
          <Text c="dimmed" size="sm">
            {tab === 'pending' ? 'No calls waiting.' : 'No completed calls yet.'}
          </Text>
        )}
      </Stack>
      {total > PAGE_SIZE && (
        <Group justify="space-between" mt="sm">
          <Text size="xs" c="dimmed">
            Page {page} of {pages}, {total} orders
          </Text>
          <Group gap="xs">
            <Button
              size="compact-sm"
              variant="default"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="compact-sm"
              variant="default"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </Group>
        </Group>
      )}
      {active && (
        <CallOutcomeModal
          key={`${active.order.id}-${active.outcome}`}
          opened
          onClose={() => setActive(null)}
          orderId={active.order.id}
          orderNo={active.order.orderNo}
          initial={active.outcome}
        />
      )}
    </div>
  );
}
