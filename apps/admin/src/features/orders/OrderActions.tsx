import { Button, Group, Tooltip } from '@mantine/core';
import { useState } from 'react';
import { ConfirmAction, ReasonModal } from '~/features/b2b/components';
import { notifyOk } from '~/features/categories/queries';
import { useCan } from '~/lib/perm';
import { ordersApi } from './api';
import { CallOutcomeModal } from './CallOutcomeModal';
import { availableActions, cancelBlockedReason } from './logic';
import { type OrderDetail, useInvalidateOrders } from './queries';

type Open = null | 'hold' | 'resume' | 'cancel' | 'call';

/** Hold / resume / cancel / log call, hidden or disabled by permission and order state. */
export function OrderActions({ order }: { order: OrderDetail }) {
  const canManage = useCan('orders.manage');
  const canCall = useCan('orders.call');
  const invalidate = useInvalidateOrders();
  const [open, setOpen] = useState<Open>(null);
  const can = availableActions(order);
  const blocked = cancelBlockedReason(order);
  const close = () => setOpen(null);

  return (
    <>
      <Group gap="xs">
        {canCall && can.call && <Button onClick={() => setOpen('call')}>Log call</Button>}
        {canManage && can.hold && (
          <Button variant="default" onClick={() => setOpen('hold')}>
            Put on hold
          </Button>
        )}
        {canManage && can.resume && <Button onClick={() => setOpen('resume')}>Resume</Button>}
        {canManage && can.cancel && (
          <Tooltip label={blocked} disabled={!blocked} multiline maw={260}>
            <span>
              <Button
                variant="default"
                color="red"
                disabled={!!blocked}
                onClick={() => setOpen('cancel')}
              >
                Cancel order
              </Button>
            </span>
          </Tooltip>
        )}
      </Group>

      <ReasonModal
        opened={open === 'hold'}
        onClose={close}
        title="Put order on hold"
        confirmLabel="Put on hold"
        onSubmit={async (reason) => {
          await ordersApi.hold(order.id, reason);
          notifyOk('Order put on hold');
          invalidate();
        }}
      >
        Stock stays reserved and the order cannot ship until you resume it.
      </ReasonModal>

      <ReasonModal
        opened={open === 'cancel'}
        onClose={close}
        title={`Cancel ${order.orderNo}`}
        confirmLabel="Cancel order"
        onSubmit={async (reason) => {
          await ordersApi.cancel(order.id, reason);
          notifyOk('Order cancelled');
          invalidate();
        }}
      >
        Reserved stock is released. Money already paid is refunded separately.
      </ReasonModal>

      <ConfirmAction
        opened={open === 'resume'}
        onClose={close}
        title="Resume order"
        confirmLabel="Resume"
        onConfirm={async () => {
          await ordersApi.resume(order.id);
          notifyOk('Order resumed');
          invalidate();
        }}
      >
        Put {order.orderNo} back into processing?
      </ConfirmAction>

      <CallOutcomeModal
        opened={open === 'call'}
        onClose={close}
        orderId={order.id}
        orderNo={order.orderNo}
      />
    </>
  );
}
