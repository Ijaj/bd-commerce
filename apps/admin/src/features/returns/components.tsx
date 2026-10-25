import { Badge } from '@mantine/core';
import classes from '~/features/orders/Orders.module.css';
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
    <ol className={classes.steps} aria-label="Return progress">
      {stepStates(status).map(({ step, state }, i) => (
        <li key={step} className={classes.stepItem}>
          {i > 0 && (
            <span className={classes.sep} aria-hidden>
              /
            </span>
          )}
          <Badge
            size="sm"
            variant={state === 'current' ? 'filled' : 'light'}
            color={state === 'todo' ? 'gray' : RETURN_STATUS_COLOR[step]}
            data-state={state}
          >
            {RETURN_STATUS_LABEL[step]}
          </Badge>
        </li>
      ))}
    </ol>
  );
}
