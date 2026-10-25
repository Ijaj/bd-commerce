import { Badge, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { formatDateTime } from '~/lib/format';
import { CallBadge } from './badges';
import { actorText, riskReasonText } from './logic';
import type { OrderDetail } from './queries';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

/** Customer, ship-to, call/risk and notes. */
export function OrderInfoCards({ order }: { order: OrderDetail }) {
  const s = order.shipTo;
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }}>
      <Paper withBorder p="md">
        <Text mb="xs">Customer</Text>
        <Stack gap="xs">
          <Field label="Name">
            {order.customer.name}
            {order.customer.isGuest && ' (guest)'}
          </Field>
          <Field label="Phone">{order.customer.phone}</Field>
          <Field label="Language">{order.lang === 'bn' ? 'Bangla' : 'English'}</Field>
        </Stack>
      </Paper>
      <Paper withBorder p="md">
        <Text mb="xs">Ship to</Text>
        <Stack gap="xs">
          <Field label="Recipient">
            {s.name} · {s.phone}
          </Field>
          <Field label="Address">
            {s.line}
            {s.landmark && ` (${s.landmark})`}
            <br />
            {s.placeText}
          </Field>
          <Field label="Delivery zone">{order.zone.nameEn}</Field>
        </Stack>
      </Paper>
      <Paper withBorder p="md">
        <Text mb="xs">Call and risk</Text>
        <Stack gap="xs">
          <Field label="Call">
            <Group gap="xs">
              <CallBadge status={order.call.status} />
              {order.call.status === 'not_needed' && 'Not needed'}
            </Group>
            {order.call.at && (
              <Text size="xs" c="dimmed">
                {order.call.staffName ?? 'Staff'} · {formatDateTime(order.call.at)}
              </Text>
            )}
            {order.call.note && <Text size="xs">{order.call.note}</Text>}
          </Field>
          <Field label="Risk">
            {order.risk.reasons.length === 0 ? (
              'None flagged'
            ) : (
              <Group gap={4}>
                {order.risk.reasons.map((r) => (
                  <Badge key={r} size="sm" variant="outline" color="orange">
                    {riskReasonText(r)}
                  </Badge>
                ))}
              </Group>
            )}
          </Field>
          {order.customerNote && <Field label="Customer note">{order.customerNote}</Field>}
          {order.heldReason && <Field label="Hold reason">{order.heldReason}</Field>}
          {order.cancelReason && <Field label="Cancel reason">{order.cancelReason}</Field>}
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}

export function OrderHistoryCard({ order }: { order: OrderDetail }) {
  return (
    <Paper withBorder p="md">
      <Text mb="xs">Status history</Text>
      <Stack gap="xs">
        {order.history.map((h) => (
          <div key={h.id}>
            <Text size="sm">
              {h.fromStatus ? `${label(h.fromStatus)} to ${label(h.toStatus)}` : label(h.toStatus)}
            </Text>
            <Text size="xs" c="dimmed">
              {actorText(h)} · {formatDateTime(h.at)}
              {h.note ? ` · ${h.note}` : ''}
            </Text>
          </div>
        ))}
      </Stack>
    </Paper>
  );
}

function label(s: string) {
  const t = s.replace(/_/g, ' ');
  return t[0]?.toUpperCase() + t.slice(1);
}
