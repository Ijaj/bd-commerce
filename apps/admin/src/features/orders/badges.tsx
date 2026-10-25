import { Badge, Group, Tooltip } from '@mantine/core';
import type { CallStatus, OrderStatus, PaymentStatus } from './api';
import {
  CALL_COLOR,
  CALL_LABEL,
  PAYMENT_COLOR,
  PAYMENT_LABEL,
  riskColor,
  riskReasonText,
  STATUS_COLOR,
  STATUS_LABEL,
} from './logic';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge size="sm" variant="light" color={STATUS_COLOR[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge size="sm" variant="light" color={PAYMENT_COLOR[status]}>
      {PAYMENT_LABEL[status]}
    </Badge>
  );
}

export function CallBadge({ status }: { status: CallStatus }) {
  if (status === 'not_needed') return null;
  return (
    <Badge size="sm" variant="light" color={CALL_COLOR[status]}>
      {CALL_LABEL[status]}
    </Badge>
  );
}

/** Shown only when the order was flagged; hover lists why. */
export function RiskBadge({ score, reasons }: { score: number; reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <Tooltip label={reasons.map(riskReasonText).join(', ')} multiline maw={260}>
      <Badge size="sm" variant="outline" color={riskColor(score)}>
        Risk {score}
      </Badge>
    </Tooltip>
  );
}

export function OrderBadges({
  status,
  paymentStatus,
  callStatus,
  riskScore,
  riskReasons,
}: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  callStatus: CallStatus;
  riskScore: number;
  riskReasons: string[];
}) {
  return (
    <Group gap={4}>
      <StatusBadge status={status} />
      <PaymentBadge status={paymentStatus} />
      <CallBadge status={callStatus} />
      <RiskBadge score={riskScore} reasons={riskReasons} />
    </Group>
  );
}
