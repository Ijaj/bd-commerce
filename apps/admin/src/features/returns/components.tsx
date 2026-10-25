import { Badge, Group, Text } from '@mantine/core';
import {
  REFUND_STATUS_COLOR,
  REFUND_STATUS_LABEL,
  RETURN_STATUS_COLOR,
  RETURN_STATUS_LABEL,
  stepStates,
} from './logic';
import type { RefundStatus, ReturnStatus } from './queries';

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <Badge size="sm" variant="light" color={RETURN_STATUS_COLOR[status]}>
      {RETURN_STATUS_LABEL[status]}
    </Badge>
  );
}

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return (
    <Badge size="sm" variant="light" color={REFUND_STATUS_COLOR[status]}>
      {REFUND_STATUS_LABEL[status]}
    </Badge>
  );
}

/** The API stores no per-step history, so this shows progress along the path rather than dates. */
export function ReturnTimeline({ status }: { status: ReturnStatus }) {
  return (
    <Group gap="xs" aria-label="Return progress">
      {stepStates(status).map(({ step, state }, i) => (
        <Group key={step} gap="xs" wrap="nowrap">
          {i > 0 && (
            <Text size="sm" c="dimmed" aria-hidden>
              /
            </Text>
          )}
          <Badge
            size="sm"
            variant={state === 'current' ? 'filled' : 'light'}
            color={state === 'todo' ? 'gray' : RETURN_STATUS_COLOR[step]}
            data-state={state}
          >
            {RETURN_STATUS_LABEL[step]}
          </Badge>
        </Group>
      ))}
    </Group>
  );
}
